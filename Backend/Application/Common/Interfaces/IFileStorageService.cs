using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces
{
    /// <summary>
    /// Contract for server-side file storage operations.
    /// Provides WebP conversion for images, original format retention for videos and PDFs,
    /// safe path-traversal prevention, and failure-aware file management.
    /// </summary>
    public interface IFileStorageService
    {
        /// <summary>
        /// Uploads an image, validates its format and magic bytes, and converts it to optimized WebP.
        /// </summary>
        Task<string> UploadImageAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Uploads an image from a stream, validates its format and magic bytes, and converts it to optimized WebP.
        /// </summary>
        Task<string> UploadImageAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Uploads a video file, validates its format and magic bytes, and stores it in its original format.
        /// </summary>
        Task<string> UploadVideoAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Uploads a video from a stream, validates its format and magic bytes, and stores it in its original format.
        /// </summary>
        Task<string> UploadVideoAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Uploads a PDF document, validates its format and magic bytes, and stores it in its original format.
        /// </summary>
        Task<string> UploadPdfAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Uploads a PDF from a stream, validates its format and magic bytes, and stores it in its original format.
        /// </summary>
        Task<string> UploadPdfAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Polymorphic file upload: routes images to WebP optimization, and videos/PDFs to direct storage.
        /// </summary>
        Task<string> UploadFileAsync(IFormFile file, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Polymorphic stream upload: routes images to WebP optimization, and videos/PDFs to direct storage.
        /// </summary>
        Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName, CancellationToken cancellationToken = default);

        /// <summary>
        /// Synchronous upload for backward compatibility.
        /// </summary>
        string Upload(IFormFile file, string folderName);

        /// <summary>
        /// Deletes a file from the specified folder under wwwroot/files, preventing path traversal.
        /// </summary>
        void Delete(string fileName, string folderName);

        /// <summary>
        /// Generates the public URL for a file stored under wwwroot/files.
        /// If baseUrl is omitted or null, resolves from configuration or context.
        /// </summary>
        string GetFileUrl(string fileName, string folderName, string? baseUrl = null);
    }
}
