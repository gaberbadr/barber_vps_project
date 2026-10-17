using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace Infrastructure.Storage.Documents
{
    /// <summary>
    /// Core file storage and media processing engine.
    /// Manages file validation, safe local file persistence under wwwroot/files,
    /// path-traversal prevention, EXIF orientation correction, and size-aware progressive WebP conversion for images.
    /// Retains original formats for videos and PDFs without conversion.
    /// </summary>
    public static class DocumentSetting
    {
        private const int WebpQuality = 75;
        private const int PreferredTargetBytes = 100 * 1024;    // 100 KB
        private const int AcceptableTargetBytes = 150 * 1024;   // 150 KB
        private const int MaximumTargetBytes = 200 * 1024;      // 200 KB
        private const long MaxImageSizeInBytes = 30 * 1024 * 1024; // 30 MB
        private const long MaxVideoSizeInBytes = 100 * 1024 * 1024; // 100 MB
        private const long MaxPdfSizeInBytes = 25 * 1024 * 1024; // 25 MB

        public const string UnsupportedFormatErrorMessage =
            "Only image files are allowed. Please upload a valid image (JPG, JPEG, PNG, BMP, TIFF, or WebP).";

        public const string CorruptedImageErrorMessage =
            "The uploaded image content is corrupted or invalid.";

        public const string UnsupportedVideoFormatErrorMessage =
            "Only video files are allowed (MP4, WebM, OGG, MOV, AVI, or MKV).";

        public const string CorruptedVideoErrorMessage =
            "The uploaded video content is corrupted or invalid.";

        public const string UnsupportedPdfFormatErrorMessage =
            "Only PDF documents are allowed.";

        public const string CorruptedPdfErrorMessage =
            "The uploaded PDF document content is corrupted or invalid.";

        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"
        };

        private static readonly HashSet<string> AllowedImageFormatNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "JPEG", "PNG", "BMP", "TIFF", "WebP"
        };

        private static readonly HashSet<string> AllowedVideoExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"
        };

        #region Image Upload & Progressive WebP Optimization

        /// <summary>
        /// Synchronous upload for backward compatibility with existing callers.
        /// </summary>
        public static string Upload(IFormFile file, string folderName)
        {
            return UploadImageAsync(file, folderName).GetAwaiter().GetResult();
        }

        public static async Task<string> UploadAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            return await UploadImageAsync(file, folderName, cancellationToken);
        }

        public static async Task<string> UploadImageAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file is empty.", nameof(file));
            }

            using var stream = file.OpenReadStream();
            return await UploadImageAsync(stream, file.FileName, folderName, cancellationToken);
        }

        public static async Task<string> UploadImageAsync(Stream inputStream, string originalFileName, string folderName, CancellationToken cancellationToken = default)
        {
            if (inputStream == null || inputStream.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file stream is empty.", nameof(inputStream));
            }

            if (inputStream.Length > MaxImageSizeInBytes)
            {
                throw new InvalidOperationException($"File size exceeds maximum allowed size of {MaxImageSizeInBytes / (1024 * 1024)}MB.");
            }

            var extension = Path.GetExtension(originalFileName);
            if (string.IsNullOrEmpty(extension) || !AllowedImageExtensions.Contains(extension))
            {
                throw new InvalidOperationException(UnsupportedFormatErrorMessage);
            }

            // Ensure stream is seekable for multi-pass format inspection and decoding
            Stream workingStream = inputStream;
            MemoryStream? memoryStream = null;
            if (!inputStream.CanSeek)
            {
                memoryStream = new MemoryStream();
                await inputStream.CopyToAsync(memoryStream, cancellationToken);
                memoryStream.Position = 0;
                workingStream = memoryStream;
            }

            try
            {
                long startPosition = workingStream.Position;

                // Inspect file content header (magic bytes) to verify it is an actual supported raster image
                IImageFormat? detectedFormat = null;
                try
                {
                    detectedFormat = await Image.DetectFormatAsync(workingStream, cancellationToken);
                }
                catch (Exception)
                {
                    throw new InvalidOperationException(UnsupportedFormatErrorMessage);
                }

                if (detectedFormat == null || !AllowedImageFormatNames.Contains(detectedFormat.Name))
                {
                    throw new InvalidOperationException(UnsupportedFormatErrorMessage);
                }

                workingStream.Position = startPosition;
                bool isWebp = detectedFormat.Name.Equals("WebP", StringComparison.OrdinalIgnoreCase);

                string folderPath = GetFolderPath(folderName);
                if (!Directory.Exists(folderPath))
                {
                    Directory.CreateDirectory(folderPath);
                }

                string cleanName = GetSafeFileName(originalFileName);

                // Fast-path: If the image is already a WebP, within preferred size (<= 100 KB),
                // and within display dimensions (<= 1600px), save directly to avoid generational quality loss.
                if (isWebp && workingStream.Length <= PreferredTargetBytes)
                {
                    ImageInfo? imageInfo;
                    try
                    {
                        imageInfo = await Image.IdentifyAsync(workingStream, cancellationToken);
                    }
                    catch (Exception)
                    {
                        throw new InvalidOperationException(CorruptedImageErrorMessage);
                    }

                    if (imageInfo == null || imageInfo.Width <= 0 || imageInfo.Height <= 0)
                    {
                        throw new InvalidOperationException(CorruptedImageErrorMessage);
                    }

                    if (Math.Max(imageInfo.Width, imageInfo.Height) <= 1600)
                    {
                        string webpFileName = $"{Guid.NewGuid()}_{cleanName}.webp";
                        string filePath = Path.Combine(folderPath, webpFileName);

                        try
                        {
                            workingStream.Position = startPosition;
                            using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
                            await workingStream.CopyToAsync(fileStream, cancellationToken);
                            return webpFileName;
                        }
                        catch (Exception)
                        {
                            CleanupFile(filePath);
                            throw;
                        }
                    }
                }

                // Load image for conversion and progressive optimization
                Image image;
                try
                {
                    workingStream.Position = startPosition;
                    image = await Image.LoadAsync(workingStream, cancellationToken);
                }
                catch (UnknownImageFormatException)
                {
                    throw new InvalidOperationException(UnsupportedFormatErrorMessage);
                }
                catch (InvalidImageContentException)
                {
                    throw new InvalidOperationException(CorruptedImageErrorMessage);
                }
                catch (Exception)
                {
                    throw new InvalidOperationException(CorruptedImageErrorMessage);
                }

                using (image)
                {
                    if (image.Width <= 0 || image.Height <= 0)
                    {
                        throw new InvalidOperationException(CorruptedImageErrorMessage);
                    }

                    // Auto-orient based on EXIF metadata if present, maintaining aspect ratio without upscaling
                    image.Mutate(x => x.AutoOrient());

                    // Perform intelligent size-aware progressive optimization
                    using var webpStream = await OptimizeToWebpAsync(image, workingStream.Length, cancellationToken);

                    long webpSizeInBytes = webpStream.Length;
                    long originalSizeInBytes = workingStream.Length;

                    // If WebP output is strictly smaller than original uploaded file, store WebP
                    if (webpSizeInBytes < originalSizeInBytes)
                    {
                        string webpFileName = $"{Guid.NewGuid()}_{cleanName}.webp";
                        string filePath = Path.Combine(folderPath, webpFileName);

                        try
                        {
                            webpStream.Position = 0;
                            using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
                            await webpStream.CopyToAsync(fileStream, cancellationToken);
                            return webpFileName;
                        }
                        catch (Exception)
                        {
                            CleanupFile(filePath);
                            throw;
                        }
                    }
                    else
                    {
                        // WebP is equal to or larger: fallback to preserve original file bytes, format, and extension
                        string originalExtension = Path.GetExtension(originalFileName);
                        if (string.IsNullOrWhiteSpace(originalExtension))
                        {
                            originalExtension = detectedFormat.FileExtensions.FirstOrDefault() ?? ".jpg";
                            if (!originalExtension.StartsWith("."))
                            {
                                originalExtension = "." + originalExtension;
                            }
                        }
                        originalExtension = originalExtension.ToLowerInvariant();

                        string fallbackFileName = $"{Guid.NewGuid()}_{cleanName}{originalExtension}";
                        string fallbackFilePath = Path.Combine(folderPath, fallbackFileName);

                        try
                        {
                            workingStream.Position = startPosition;
                            using var fileStream = new FileStream(fallbackFilePath, FileMode.Create, FileAccess.Write, FileShare.None);
                            await workingStream.CopyToAsync(fileStream, cancellationToken);
                            return fallbackFileName;
                        }
                        catch (Exception)
                        {
                            CleanupFile(fallbackFilePath);
                            throw;
                        }
                    }
                }
            }
            finally
            {
                memoryStream?.Dispose();
            }
        }

        private static async Task<MemoryStream> OptimizeToWebpAsync(Image sourceImage, long originalFileSize, CancellationToken cancellationToken)
        {
            int origWidth = sourceImage.Width;
            int origHeight = sourceImage.Height;
            int origMaxDim = Math.Max(origWidth, origHeight);

            // Tier 1: Large images (> 7 MB up to 30 MB)
            // Policy: Sensible resizing (max 1920px), high quality (70), do not force medium-image targets
            if (originalFileSize > 7 * 1024 * 1024)
            {
                int targetMax = 1920;
                bool needsResize = origMaxDim > targetMax;
                using var workingImage = sourceImage.Clone(ctx =>
                {
                    if (needsResize)
                    {
                        ctx.Resize(new ResizeOptions
                        {
                            Mode = ResizeMode.Max,
                            Size = new Size(targetMax, targetMax),
                            Sampler = KnownResamplers.Lanczos3
                        });
                    }
                });

                var encoder = new WebpEncoder
                {
                    Quality = 70,
                    Method = WebpEncodingMethod.Level5,
                    SkipMetadata = true,
                    FileFormat = WebpFileFormatType.Lossy,
                    TransparentColorMode = WebpTransparentColorMode.Preserve
                };

                var ms = new MemoryStream();
                await workingImage.SaveAsWebpAsync(ms, encoder, cancellationToken);
                return ms;
            }

            // Tier 2: Already-small images (< 1 MB)
            // Policy: Efficient processing, preserve quality, avoid increasing file size
            if (originalFileSize < 1024 * 1024)
            {
                int targetMax = 1600;
                bool needsResize = origMaxDim > targetMax;
                using var workingImage = sourceImage.Clone(ctx =>
                {
                    if (needsResize)
                    {
                        ctx.Resize(new ResizeOptions
                        {
                            Mode = ResizeMode.Max,
                            Size = new Size(targetMax, targetMax),
                            Sampler = KnownResamplers.Lanczos3
                        });
                    }
                });

                int quality = originalFileSize <= PreferredTargetBytes ? WebpQuality : 65;
                var encoder = new WebpEncoder
                {
                    Quality = quality,
                    Method = WebpEncodingMethod.Level5,
                    SkipMetadata = true,
                    FileFormat = WebpFileFormatType.Lossy,
                    TransparentColorMode = WebpTransparentColorMode.Preserve
                };

                var ms = new MemoryStream();
                await workingImage.SaveAsWebpAsync(ms, encoder, cancellationToken);

                // If output exceeds preferred target and was at Q65, test Q55
                if (ms.Length > PreferredTargetBytes && quality == 65)
                {
                    var fallbackEncoder = new WebpEncoder
                    {
                        Quality = 55,
                        Method = WebpEncodingMethod.Level5,
                        SkipMetadata = true,
                        FileFormat = WebpFileFormatType.Lossy,
                        TransparentColorMode = WebpTransparentColorMode.Preserve
                    };

                    var msFallback = new MemoryStream();
                    await workingImage.SaveAsWebpAsync(msFallback, fallbackEncoder, cancellationToken);
                    if (msFallback.Length <= PreferredTargetBytes || msFallback.Length < ms.Length)
                    {
                        ms.Dispose();
                        return msFallback;
                    }
                    msFallback.Dispose();
                }

                return ms;
            }

            // Tier 3: Medium images (1 MB to 7 MB) - Primary optimization target
            // Targets: Preferred < 100 KB, Acceptable 100-150 KB, Maximum 200 KB
            var candidates = new (int maxDim, int quality)[]
            {
                (1600, 60),
                (1600, 50),
                (1440, 50),
                (1280, 50),
                (1280, 45),
                (1200, 42)
            };

            MemoryStream? bestMs = null;
            Image? currentWorkingImage = null;
            int currentDim = 0;

            try
            {
                foreach (var (maxDim, quality) in candidates)
                {
                    int effectiveDim = Math.Min(origMaxDim, maxDim);
                    bool resizedThisStep = origMaxDim > effectiveDim;

                    if (currentWorkingImage == null || currentDim != effectiveDim)
                    {
                        currentWorkingImage?.Dispose();
                        currentWorkingImage = sourceImage.Clone(ctx =>
                        {
                            if (resizedThisStep)
                            {
                                ctx.Resize(new ResizeOptions
                                {
                                    Mode = ResizeMode.Max,
                                    Size = new Size(effectiveDim, effectiveDim),
                                    Sampler = KnownResamplers.Lanczos3
                                });
                            }
                        });
                        currentDim = effectiveDim;
                    }

                    var encoder = new WebpEncoder
                    {
                        Quality = quality,
                        Method = WebpEncodingMethod.Level5,
                        SkipMetadata = true,
                        FileFormat = WebpFileFormatType.Lossy,
                        TransparentColorMode = WebpTransparentColorMode.Preserve
                    };

                    var candidateMs = new MemoryStream();
                    await currentWorkingImage.SaveAsWebpAsync(candidateMs, encoder, cancellationToken);

                    bestMs?.Dispose();
                    bestMs = candidateMs;

                    // If preferred target (< 100 KB) is reached, stop immediately
                    if (candidateMs.Length <= PreferredTargetBytes)
                    {
                        break;
                    }
                }

                var result = bestMs!;
                bestMs = null;
                return result;
            }
            finally
            {
                bestMs?.Dispose();
                currentWorkingImage?.Dispose();
            }
        }

        #endregion

        #region Video Upload (Original Format Retention)

        public static async Task<string> UploadVideoAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file is empty.", nameof(file));
            }

            using var stream = file.OpenReadStream();
            return await UploadVideoAsync(stream, file.FileName, folderName, cancellationToken);
        }

        public static async Task<string> UploadVideoAsync(Stream inputStream, string originalFileName, string folderName, CancellationToken cancellationToken = default)
        {
            if (inputStream == null || inputStream.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file stream is empty.", nameof(inputStream));
            }

            if (inputStream.Length > MaxVideoSizeInBytes)
            {
                throw new InvalidOperationException($"File size exceeds maximum allowed video size of {MaxVideoSizeInBytes / (1024 * 1024)}MB.");
            }

            var extension = Path.GetExtension(originalFileName);
            if (string.IsNullOrEmpty(extension) || !AllowedVideoExtensions.Contains(extension))
            {
                throw new InvalidOperationException(UnsupportedVideoFormatErrorMessage);
            }

            Stream workingStream = inputStream;
            MemoryStream? memoryStream = null;
            if (!inputStream.CanSeek)
            {
                memoryStream = new MemoryStream();
                await inputStream.CopyToAsync(memoryStream, cancellationToken);
                memoryStream.Position = 0;
                workingStream = memoryStream;
            }

            try
            {
                await ValidateVideoMagicBytesAsync(workingStream, extension, cancellationToken);

                string folderPath = GetFolderPath(folderName);
                if (!Directory.Exists(folderPath))
                {
                    Directory.CreateDirectory(folderPath);
                }

                string cleanName = GetSafeFileName(originalFileName);
                string uniqueFileName = $"{Guid.NewGuid()}_{cleanName}{extension.ToLowerInvariant()}";
                string filePath = Path.Combine(folderPath, uniqueFileName);

                try
                {
                    workingStream.Position = 0;
                    using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
                    await workingStream.CopyToAsync(fileStream, cancellationToken);
                    return uniqueFileName;
                }
                catch (Exception)
                {
                    CleanupFile(filePath);
                    throw;
                }
            }
            finally
            {
                memoryStream?.Dispose();
            }
        }

        private static async Task ValidateVideoMagicBytesAsync(Stream stream, string extension, CancellationToken cancellationToken)
        {
            long originalPosition = stream.CanSeek ? stream.Position : 0;
            byte[] header = new byte[16];
            int bytesRead = await stream.ReadAsync(header.AsMemory(0, 16), cancellationToken);
            if (stream.CanSeek)
            {
                stream.Position = originalPosition;
            }

            if (bytesRead < 4)
            {
                throw new InvalidOperationException(CorruptedVideoErrorMessage);
            }

            var ext = extension.ToLowerInvariant();
            bool isValid = false;

            if (ext is ".mp4" or ".mov")
            {
                // ISO BMFF / QuickTime container: box header contains ftyp, moov, mdat, wide, free, or skip
                if (bytesRead >= 8)
                {
                    string boxType = Encoding.ASCII.GetString(header, 4, 4);
                    if (boxType is "ftyp" or "moov" or "mdat" or "wide" or "free" or "skip")
                    {
                        isValid = true;
                    }
                }
            }
            else if (ext is ".webm" or ".mkv")
            {
                // EBML Header: 0x1A, 0x45, 0xDF, 0xA3
                if (header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3)
                {
                    isValid = true;
                }
            }
            else if (ext == ".avi")
            {
                // RIFF....AVI 
                if (bytesRead >= 12 &&
                    header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
                    header[8] == 0x41 && header[9] == 0x56 && header[10] == 0x49 && header[11] == 0x20)
                {
                    isValid = true;
                }
            }
            else if (ext == ".ogg")
            {
                // OggS
                if (header[0] == 0x4F && header[1] == 0x67 && header[2] == 0x67 && header[3] == 0x53)
                {
                    isValid = true;
                }
            }

            if (!isValid)
            {
                throw new InvalidOperationException(CorruptedVideoErrorMessage);
            }
        }

        #endregion

        #region PDF Upload (Original Format Retention)

        public static async Task<string> UploadPdfAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file is empty.", nameof(file));
            }

            using var stream = file.OpenReadStream();
            return await UploadPdfAsync(stream, file.FileName, folderName, cancellationToken);
        }

        public static async Task<string> UploadPdfAsync(Stream inputStream, string originalFileName, string folderName, CancellationToken cancellationToken = default)
        {
            if (inputStream == null || inputStream.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file stream is empty.", nameof(inputStream));
            }

            if (inputStream.Length > MaxPdfSizeInBytes)
            {
                throw new InvalidOperationException($"File size exceeds maximum allowed PDF size of {MaxPdfSizeInBytes / (1024 * 1024)}MB.");
            }

            var extension = Path.GetExtension(originalFileName);
            if (string.IsNullOrEmpty(extension) || !extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(UnsupportedPdfFormatErrorMessage);
            }

            Stream workingStream = inputStream;
            MemoryStream? memoryStream = null;
            if (!inputStream.CanSeek)
            {
                memoryStream = new MemoryStream();
                await inputStream.CopyToAsync(memoryStream, cancellationToken);
                memoryStream.Position = 0;
                workingStream = memoryStream;
            }

            try
            {
                await ValidatePdfMagicBytesAsync(workingStream, cancellationToken);

                string folderPath = GetFolderPath(folderName);
                if (!Directory.Exists(folderPath))
                {
                    Directory.CreateDirectory(folderPath);
                }

                string cleanName = GetSafeFileName(originalFileName);
                string uniqueFileName = $"{Guid.NewGuid()}_{cleanName}.pdf";
                string filePath = Path.Combine(folderPath, uniqueFileName);

                try
                {
                    workingStream.Position = 0;
                    using var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
                    await workingStream.CopyToAsync(fileStream, cancellationToken);
                    return uniqueFileName;
                }
                catch (Exception)
                {
                    CleanupFile(filePath);
                    throw;
                }
            }
            finally
            {
                memoryStream?.Dispose();
            }
        }

        private static async Task ValidatePdfMagicBytesAsync(Stream stream, CancellationToken cancellationToken)
        {
            long originalPosition = stream.CanSeek ? stream.Position : 0;
            byte[] header = new byte[5];
            int bytesRead = await stream.ReadAsync(header.AsMemory(0, 5), cancellationToken);
            if (stream.CanSeek)
            {
                stream.Position = originalPosition;
            }

            // PDF signature: starts with "%PDF" (0x25, 0x50, 0x44, 0x46)
            if (bytesRead < 4 || header[0] != 0x25 || header[1] != 0x50 || header[2] != 0x44 || header[3] != 0x46)
            {
                throw new InvalidOperationException(CorruptedPdfErrorMessage);
            }
        }

        #endregion

        #region Polymorphic Upload

        public static async Task<string> UploadFileAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
            {
                throw new ArgumentException("No file was uploaded or file is empty.", nameof(file));
            }

            using var stream = file.OpenReadStream();
            return await UploadFileAsync(stream, file.FileName, folderName, cancellationToken);
        }

        public static async Task<string> UploadFileAsync(Stream inputStream, string originalFileName, string folderName, CancellationToken cancellationToken = default)
        {
            var extension = Path.GetExtension(originalFileName);
            if (string.IsNullOrEmpty(extension))
            {
                throw new InvalidOperationException("Uploaded file must have a valid file extension.");
            }

            if (AllowedImageExtensions.Contains(extension))
            {
                return await UploadImageAsync(inputStream, originalFileName, folderName, cancellationToken);
            }

            if (AllowedVideoExtensions.Contains(extension))
            {
                return await UploadVideoAsync(inputStream, originalFileName, folderName, cancellationToken);
            }

            if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                return await UploadPdfAsync(inputStream, originalFileName, folderName, cancellationToken);
            }

            throw new InvalidOperationException($"Unsupported file type '{extension}'. Supported types are images (JPG, PNG, WebP, etc.), videos (MP4, WebM, etc.), and PDFs.");
        }

        #endregion

        #region Deletion & Path Traversal Security

        public static void Delete(string fileName, string folderName)
        {
            if (string.IsNullOrWhiteSpace(fileName) || string.IsNullOrWhiteSpace(folderName))
            {
                return;
            }

            try
            {
                // Safety guard: Never touch external cloud assets (e.g. Cloudinary URLs or public identifiers)
                if (fileName.Contains("res.cloudinary.com", StringComparison.OrdinalIgnoreCase) ||
                    fileName.Contains("cloudinary.com", StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                if (Uri.TryCreate(fileName, UriKind.Absolute, out var uri))
                {
                    fileName = uri.LocalPath;
                }
                else
                {
                    var qIndex = fileName.IndexOf('?');
                    if (qIndex >= 0)
                    {
                        fileName = fileName.Substring(0, qIndex);
                    }
                }

                string safeFileName = Path.GetFileName(fileName);
                string safeFolderName = GetSafeFolderName(folderName);

                if (string.IsNullOrWhiteSpace(safeFileName) || string.IsNullOrWhiteSpace(safeFolderName))
                {
                    return;
                }

                var candidateBaseDirs = GetCandidateBaseDirectories();

                foreach (var baseFilesDir in candidateBaseDirs)
                {
                    string targetFolderDir = Path.GetFullPath(Path.Combine(baseFilesDir, safeFolderName));
                    string targetFilePath = Path.GetFullPath(Path.Combine(targetFolderDir, safeFileName));

                    // Security check: ensure targetFolderDir is strictly within baseFilesDir
                    if (!targetFolderDir.StartsWith(baseFilesDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                        && !targetFolderDir.Equals(baseFilesDir, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // Security check: ensure targetFilePath is strictly inside targetFolderDir to prevent path traversal
                    if (!targetFilePath.StartsWith(targetFolderDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (File.Exists(targetFilePath))
                    {
                        File.Delete(targetFilePath);
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Could not delete file {fileName} in {folderName}: {ex.Message}");
            }
        }

        #endregion

        #region Helpers & URL Resolution

        public static string GetFileUrl(string fileName, string folderName, string baseUrl)
        {
            string safeFileName = Path.GetFileName(fileName);
            string safeFolderName = GetSafeFolderName(folderName);
            return $"{baseUrl.TrimEnd('/')}/files/{safeFolderName}/{safeFileName}";
        }

        public static string GetFolderPath(string folderName)
        {
            string safeFolderName = GetSafeFolderName(folderName);
            var candidateBaseDirs = GetCandidateBaseDirectories();
            string chosenBaseDir = candidateBaseDirs.FirstOrDefault(Directory.Exists) ?? candidateBaseDirs[0];
            return Path.Combine(chosenBaseDir, safeFolderName);
        }

        public static string GetSafeFolderName(string folderName)
        {
            if (string.IsNullOrWhiteSpace(folderName))
            {
                return "default";
            }

            string safe = Path.GetFileName(folderName);
            safe = string.Join("_", safe.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)).Trim();
            return string.IsNullOrWhiteSpace(safe) ? "default" : safe;
        }

        public static string GetSafeFileName(string originalFileName)
        {
            string rawName = Path.GetFileNameWithoutExtension(originalFileName);
            string cleanName = string.Join("_", rawName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries)).Trim();
            return string.IsNullOrWhiteSpace(cleanName) ? "file" : cleanName;
        }

        private static string[] GetCandidateBaseDirectories()
        {
            return new[]
            {
                Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "files")),
                Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "API", "wwwroot", "files")),
                Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "wwwroot", "files"))
            };
        }

        private static void CleanupFile(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
            }
            catch
            {
                // Suppress cleanup exceptions to preserve original exception
            }
        }

        #endregion
    }
}
