using System;
using System.Collections.Generic;
using Domain.Entities;
using Domain.Enums;

namespace Domain.Entities
{
    public class Booking : BaseEntity<int>
    {
        public string CustomerId { get; set; } = string.Empty;
        public string BarberId { get; set; } = string.Empty;
        public DateOnly BookingDate { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public decimal SubTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal TotalPrice { get; set; }
        public int? CouponId { get; set; }
        public string? CouponCodeSnapshot { get; set; }
        public string? CustomerNameSnapshot { get; set; }
        public string? CustomerPhoneSnapshot { get; set; }
        public BookingStatus Status { get; set; } = BookingStatus.Confirmed;
        public DateTime? CancelledAt { get; set; }
        public string? CancelledBy { get; set; }

        // Navigation
        public ApplicationUser Customer { get; set; } = null!;
        public ApplicationUser Barber { get; set; } = null!;
        public Coupon? Coupon { get; set; }
        public ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

        public void Cancel(string cancelledByUserId, DateTime utcNow)
        {
            if (Status == BookingStatus.Cancelled)
            {
                throw new InvalidOperationException("Booking is already cancelled.");
            }

            Status = BookingStatus.Cancelled;
            CancelledAt = utcNow;
            CancelledBy = cancelledByUserId;
            UpdatedAt = utcNow;
        }

        public void UpdateStatus(BookingStatus newStatus, DateTime utcNow)
        {
            Status = newStatus;
            UpdatedAt = utcNow;
        }
    }
}