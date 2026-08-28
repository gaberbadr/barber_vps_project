using Microsoft.AspNetCore.Http;
using System;
using System.IO;

namespace Infrastructure.Storage.Documents
{
    public static class DocumentSetting
    {
        public static string Upload(IFormFile file, string folderName)
        {
            string folderPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "files",
                folderName);

            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            string fileName = $"{Guid.NewGuid()}_{file.FileName}";
            string filePath = Path.Combine(folderPath, fileName);

            using var fileStream = new FileStream(filePath, FileMode.Create);
            file.CopyTo(fileStream);

            return fileName;
        }

        public static void Delete(string fileName, string folderName)
        {
            try
            {
                string filePath = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    "wwwroot",
                    "files",
                    folderName,
                    fileName);

                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
                else
                {
                    Console.WriteLine($"File not found for deletion: {filePath}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Could not delete file {fileName}: {ex.Message}");
            }
        }

        public static string GetFileUrl(
            string fileName,
            string folderName,
            string baseUrl)
        {
            return $"{baseUrl}/files/{folderName}/{fileName}";
        }
    }
}
