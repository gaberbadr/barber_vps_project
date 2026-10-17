using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;

namespace Domain.Entities
{
    public class ApplicationUser : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public bool IsActive { get; set; } = true;

        [MaxLength(10)]
        public string? VerificationCode { get; set; }

        public DateTime? CodeExpiresAt { get; set; }

        // Barber-specific properties
        public int BookingDurationMinutes { get; set; } = 30;

        public bool AcceptingBookings { get; set; } = true;

        // Profile picture stored locally
        public string? ProfilePictureUrl { get; set; }

        // Navigation Properties
        public ICollection<RefreshTokenTable> RefreshTokens { get; set; } = new List<RefreshTokenTable>();

        public ICollection<LoginAttempt> LoginAttempts { get; set; } = new List<LoginAttempt>();

        public ICollection<Booking> CustomerBookings { get; set; } = new List<Booking>();

        public ICollection<Booking> BarberBookings { get; set; } = new List<Booking>();

        public ICollection<BarberWorkingHour> BarberWorkingHours { get; set; } = new List<BarberWorkingHour>();

        public void SetVerificationCode(string code, DateTime expiresAt)
        {
            if (string.IsNullOrWhiteSpace(code))
                throw new ArgumentException("Verification code cannot be empty.", nameof(code));

            VerificationCode = code;
            CodeExpiresAt = expiresAt;
            UpdatedAt = DateTime.UtcNow;
        }

        public bool IsVerificationCodeValid(string code, DateTime utcNow)
        {
            if (string.IsNullOrWhiteSpace(VerificationCode) || CodeExpiresAt == null)
                return false;

            if (utcNow > CodeExpiresAt.Value)
                return false;

            return string.Equals(VerificationCode, code, StringComparison.Ordinal);
        }

        public void ClearVerificationCode()
        {
            VerificationCode = null;
            CodeExpiresAt = null;
            UpdatedAt = DateTime.UtcNow;
        }

        public void UpdateProfilePicture(string? url)
        {
            ProfilePictureUrl = url;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
