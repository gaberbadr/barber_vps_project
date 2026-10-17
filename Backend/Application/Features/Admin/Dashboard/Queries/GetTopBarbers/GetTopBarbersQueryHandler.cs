using Application.Features.Admin.Dashboard.DTOs;
using Domain.Entities;
using Domain.Enums;
using Domain.Repositories;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Application.Features.Admin.Dashboard.Queries.GetTopBarbers
{
    public class GetTopBarbersQueryHandler : IRequestHandler<GetTopBarbersQuery, ErrorOr<List<TopBarberDTO>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;

        public GetTopBarbersQueryHandler(
            IUnitOfWork unitOfWork,
            UserManager<ApplicationUser> userManager)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
        }

        public async Task<ErrorOr<List<TopBarberDTO>>> Handle(GetTopBarbersQuery request, CancellationToken cancellationToken)
        {
            var bookingRepo = _unitOfWork.Repository<Booking, int>();
            var validBookingStatuses = new[] { BookingStatus.Confirmed, BookingStatus.Arrived, BookingStatus.DidNotArrive };

            var topBarbers = await bookingRepo.GetIQueryable()
                .AsNoTracking()
                .Where(b => validBookingStatuses.Contains(b.Status))
                .GroupBy(b => b.BarberId)
                .Select(g => new
                {
                    BarberId = g.Key,
                    BookingCount = g.Count(),
                    TotalRevenue = g.Sum(b => b.TotalPrice)
                })
                .OrderByDescending(b => b.BookingCount)
                .Take(request.Count)
                .ToListAsync(cancellationToken);

            var barberIds = topBarbers.Select(b => b.BarberId).ToList();
            var barberNames = await _userManager.Users
                .Where(u => barberIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName })
                .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

            var result = topBarbers.Select(item => new TopBarberDTO
            {
                BarberId = item.BarberId,
                BarberName = barberNames.TryGetValue(item.BarberId, out var name) ? name : "Unknown",
                ConfirmedBookingCount = item.BookingCount,
                TotalRevenue = item.TotalRevenue
            }).ToList();

            return result;
        }
    }
}