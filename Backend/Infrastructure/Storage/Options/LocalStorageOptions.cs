namespace Infrastructure.Storage.Options
{
    public class LocalStorageOptions
    {
        public string BaseFolder { get; set; } = "files";
        public long MaxImageSizeInBytes { get; set; } = 30 * 1024 * 1024; // 30 MB
        public long MaxVideoSizeInBytes { get; set; } = 100 * 1024 * 1024; // 100 MB
        public long MaxPdfSizeInBytes { get; set; } = 25 * 1024 * 1024; // 25 MB
        public int WebpQuality { get; set; } = 75;
        public int PreferredTargetBytes { get; set; } = 100 * 1024; // 100 KB
    }
}
