using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IFileStorageService
    {
        string Upload(IFormFile file, string folderName);
        void Delete(string fileName, string folderName);
        string GetFileUrl(string fileName, string folderName, string baseUrl);
    }
}
