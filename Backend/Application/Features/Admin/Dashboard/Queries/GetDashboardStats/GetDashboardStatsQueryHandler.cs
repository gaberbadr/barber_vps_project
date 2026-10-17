using Application.Features.Admin.Dashboard.DTOs;
using Domain.Entities;
using Domain.Enums;
using Domain.Repositories;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Application.Features.Admin.Dashboard.Queries.GetDashboardStats
{
    public class GetDashboardStatsQueryHandler : IRequestHandler<GetDashboardStatsQuery, ErrorOr<DashboardStatsDTO>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly TimeProvider _timeProvider;

        public GetDashboardStatsQueryHandler(
            IUnitOfWork unitOfWork,
            UserManager<ApplicationUser> userManager,
            TimeProvider timeProvider)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _timeProvider = timeProvider;
        }

        public async Task<ErrorOr<DashboardStatsDTO>> Handle(GetDashboardStatsQuery request, CancellationToken cancellationToken)
        {
            var allUsers = await _userManager.Users.Where(u => !u.IsDeleted).ToListAsync(cancellationToken);
            var barbers = await _userManager.GetUsersInRoleAsync("Barber");
            var barberIds = barbers.Select(b => b.Id).ToHashSet();

            var bookingRepo = _unitOfWork.Repository<Booking, int>();
            var serviceRepo = _unitOfWork.Repository<Service, int>();

            var today = DateOnly.FromDateTime(_timeProvider.GetLocalNow().Date);
            var firstOfMonth = new DateOnly(today.Year, today.Month, 1);

            var validBookingStatuses = new[] { BookingStatus.Confirmed, BookingStatus.Arrived, BookingStatus.DidNotArrive };

            var bookingQuery = bookingRepo.GetIQueryable().AsNoTracking();
            var confirmedQuery = bookingQuery.Where(b => validBookingStatuses.Contains(b.Status));
            var cancelledQuery = bookingQuery.Where(b => b.Status == BookingStatus.Cancelled);

            var totalConfirmedBookings = await confirmedQuery.CountAsync(cancellationToken);
            var totalCancelledBookings = await cancelledQuery.CountAsync(cancellationToken);
            var todayConfirmedBookings = await confirmedQuery.Where(b => b.BookingDate == today).CountAsync(cancellationToken);
            var thisMonthConfirmedQuery = confirmedQuery.Where(b => b.BookingDate >= firstOfMonth);
            var thisMonthConfirmedBookings = await thisMonthConfirmedQuery.CountAsync(cancellationToken);
            var totalConfirmedRevenue = await confirmedQuery.SumAsync(b => b.TotalPrice, cancellationToken);
            var thisMonthConfirmedRevenue = await thisMonthConfirmedQuery.SumAsync(b => b.TotalPrice, cancellationToken);

            var totalServices = await serviceRepo.GetIQueryable().AsNoTracking().CountAsync(s => !s.IsDeleted, cancellationToken);

            var dto = new DashboardStatsDTO
            {
                TotalUsers = allUsers.Count(u => !barberIds.Contains(u.Id)),
                ActiveUsers = allUsers.Count(u => !barberIds.Contains(u.Id) && u.IsActive),
                BlockedUsers = allUsers.Count(u => !barberIds.Contains(u.Id) && !u.IsActive),
                TotalBarbers = barbers.Count(b => !b.IsDeleted),
                ActiveBarbers = barbers.Count(b => !b.IsDeleted && b.IsActive),
                TotalServices = totalServices,
                TotalConfirmedBookings = totalConfirmedBookings,
                TotalCancelledBookings = totalCancelledBookings,
                TodayConfirmedBookings = todayConfirmedBookings,
                ThisMonthConfirmedBookings = thisMonthConfirmedBookings,
                TotalConfirmedRevenue = totalConfirmedRevenue,
                ThisMonthConfirmedRevenue = thisMonthConfirmedRevenue
            };

            return dto;
        }
    }
}