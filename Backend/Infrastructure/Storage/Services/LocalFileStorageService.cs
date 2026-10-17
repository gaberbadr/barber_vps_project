using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Application.Interfaces;
using Infrastructure.Storage.Documents;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Storage.Services
{
    /// <summary>
    /// Service implementation for local file storage operations under wwwroot/files.
    /// Provides WebP conversion for images, original format persistence for videos and PDFs,
    /// safe deletion preventing path traversal, and flexible URL resolution.
    /// </summary>
    public class LocalFileStorageService : IFileStorageService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LocalFileStorageService> _logger;

        public LocalFileStorageService(
            IConfiguration configuration,
            ILogger<LocalFileStorageService> logger)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<string> UploadImageAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading and converting image {FileName} to WebP in {FolderName}", file?.FileName, folderName);
            return await DocumentSetting.UploadImageAsync(file!, folderName, cancellationToken);
        }

        public async Task<string> UploadImageAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading and converting image stream {FileName} to WebP in {FolderName}", fileName, folderName);
            return await DocumentSetting.UploadImageAsync(fileStream, fileName, folderName, cancellationToken);
        }

        public async Task<string> UploadVideoAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading video {FileName} in original format to {FolderName}", file?.FileName, folderName);
            return await DocumentSetting.UploadVideoAsync(file!, folderName, cancellationToken);
        }

        public async Task<string> UploadVideoAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading video stream {FileName} in original format to {FolderName}", fileName, folderName);
            return await DocumentSetting.UploadVideoAsync(fileStream, fileName, folderName, cancellationToken);
        }

        public async Task<string> UploadPdfAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading PDF document {FileName} in original format to {FolderName}", file?.FileName, folderName);
            return await DocumentSetting.UploadPdfAsync(file!, folderName, cancellationToken);
        }

        public async Task<string> UploadPdfAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading PDF stream {FileName} in original format to {FolderName}", fileName, folderName);
            return await DocumentSetting.UploadPdfAsync(fileStream, fileName, folderName, cancellationToken);
        }

        public async Task<string> UploadFileAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading file {FileName} to {FolderName}", file?.FileName, folderName);
            return await DocumentSetting.UploadFileAsync(file!, folderName, cancellationToken);
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Uploading stream {FileName} to {FolderName}", fileName, folderName);
            return await DocumentSetting.UploadFileAsync(fileStream, fileName, folderName, cancellationToken);
        }

        public string Upload(IFormFile file, string folderName)
        {
            if (file == null)
            {
                throw new ArgumentNullException(nameof(file));
            }
            _logger.LogInformation("Synchronous upload for file {FileName} in {FolderName}", file.FileName, folderName);
            return DocumentSetting.Upload(file, folderName);
        }

        public void Delete(string fileName, string folderName)
        {
            try
            {
                _logger.LogInformation("Deleting file {FileName} in folder {FolderName}", fileName, folderName);
                DocumentSetting.Delete(fileName, folderName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete file {FileName} in folder {FolderName}: {Message}", fileName, folderName, ex.Message);
            }
        }

        public string GetFileUrl(string fileName, string folderName, string? baseUrl = null)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return string.Empty;
            }

            // Already an absolute URL (e.g. external asset or cloud URL)
            if (fileName.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                fileName.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return fileName;
            }

            var effectiveBaseUrl = !string.IsNullOrWhiteSpace(baseUrl)
                ? baseUrl
                : _configuration["BaseURL"] ?? string.Empty;

            return DocumentSetting.GetFileUrl(fileName, folderName, effectiveBaseUrl);
        }
    }
}
