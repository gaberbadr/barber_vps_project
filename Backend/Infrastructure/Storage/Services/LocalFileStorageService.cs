using Application.Interfaces;
using Infrastructure.Storage.Documents;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Storage.Services
{
    public class LocalFileStorageService : IFileStorageService
    {
        private readonly IConfiguration _configuration;

        public LocalFileStorageService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string Upload(IFormFile file, string folderName)
        {
            return DocumentSetting.Upload(file, folderName);
        }

        public void Delete(string fileName, string folderName)
        {
            DocumentSetting.Delete(fileName, folderName);
        }

        public string GetFileUrl(string fileName, string folderName, string baseUrl)
        {
            // Or get baseUrl from config if not provided
            return DocumentSetting.GetFileUrl(fileName, folderName, baseUrl);
        }
    }
}
