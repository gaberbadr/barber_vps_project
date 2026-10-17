using Application.Common.Pagination;
using Application.Features.Admin.Dashboard.DTOs;
using Domain.Entities;
using Domain.Enums;
using Domain.Repositories;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Error = ErrorOr.Error;

namespace Application.Features.Admin.Dashboard.Queries.GetAllBookings
{
    public class GetAllBookingsQueryHandler : IRequestHandler<GetAllBookingsQuery, ErrorOr<PaginationResponse<AdminBookingDTO>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;

        public GetAllBookingsQueryHandler(
            IUnitOfWork unitOfWork,
            UserManager<ApplicationUser> userManager)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
        }

        public async Task<ErrorOr<PaginationResponse<AdminBookingDTO>>> Handle(
     GetAllBookingsQuery request,
     CancellationToken cancellationToken)
        {
            var bookingRepo = _unitOfWork.Repository<Booking, int>();

            BookingStatus? status = null;

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!Enum.TryParse<BookingStatus>(
                    request.Status,
                    ignoreCase: true,
                    out var parsedStatus))
                {
                    return Error.Validation(
                        code: "Booking.InvalidStatus",
                        description: $"حالة الحجز غير صحيحة: {request.Status}");
                }

                status = parsedStatus;
            }

            var query = bookingRepo.GetIQueryable()
                .Include(b => b.Customer)
                .Include(b => b.Barber)
                .AsNoTracking();

            if (request.Date.HasValue)
            {
                query = query.Where(b => b.BookingDate == request.Date.Value);
            }

            if (!string.IsNullOrEmpty(request.BarberId))
            {
                query = query.Where(b => b.BarberId == request.BarberId);
            }

            if (!string.IsNullOrEmpty(request.CustomerId))
            {
                query = query.Where(b => b.CustomerId == request.CustomerId);
            }

            if (status.HasValue)
            {
                query = query.Where(b => b.Status == status.Value);
            }

            var totalCount = await query.CountAsync(cancellationToken);

            var result = await query
                .OrderByDescending(b => b.BookingDate)
                .ThenByDescending(b => b.StartTime)
                .Skip((request.PageIndex - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(booking => new AdminBookingDTO
                {
                    Id = booking.Id,
                    CustomerName = booking.CustomerNameSnapshot ?? (booking.Customer != null ? booking.Customer.FullName : "Unknown"),
                    CustomerPhone = booking.CustomerPhoneSnapshot ?? (booking.Customer != null ? booking.Customer.PhoneNumber : null),
                    CustomerEmail = booking.Customer != null ? (booking.Customer.Email ?? "") : "",
                    BarberName = booking.Barber != null ? booking.Barber.FullName : "Unknown",
                    BookingDate = booking.BookingDate,
                    StartTime = booking.StartTime,
                    EndTime = booking.EndTime,
                    TotalPrice = booking.TotalPrice,
                    Status = booking.Status.ToString(),
                    CreatedAt = booking.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return new PaginationResponse<AdminBookingDTO>(
                request.PageSize,
                request.PageIndex,
                totalCount,
                result);
        }
    }
}