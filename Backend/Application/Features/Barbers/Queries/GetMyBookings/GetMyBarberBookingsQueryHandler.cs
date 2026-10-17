using Application.Common.Pagination;
using Application.Features.Bookings.DTOs;
using AutoMapper;
using Domain.Entities;
using Domain.Repositories;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Application.Features.Barbers.Queries.GetMyBookings
{
    public class GetMyBarberBookingsQueryHandler : IRequestHandler<GetMyBarberBookingsQuery, ErrorOr<PaginationResponse<BookingDTO>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;

        public GetMyBarberBookingsQueryHandler(
            IUnitOfWork unitOfWork,
            IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public async Task<ErrorOr<PaginationResponse<BookingDTO>>> Handle(GetMyBarberBookingsQuery request, CancellationToken cancellationToken)
        {
            var bookingRepo = _unitOfWork.Repository<Booking, int>();

            var query = bookingRepo.GetIQueryable()
                .Include(b => b.Customer)
                .Include(b => b.Barber)
                .Include(b => b.BookingItems)
                .Where(b => b.BarberId == request.BarberId)
                .AsNoTracking();

            if (request.FromDate.HasValue)
            {
                query = query.Where(b => b.BookingDate >= request.FromDate.Value);
            }

            if (request.ToDate.HasValue)
            {
                query = query.Where(b => b.BookingDate <= request.ToDate.Value);
            }

            var totalCount = await query.CountAsync(cancellationToken);

            var bookingList = await query
                .OrderByDescending(b => b.BookingDate)
                .ThenByDescending(b => b.StartTime)
                .Skip((request.PageIndex - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToListAsync(cancellationToken);

            var dtos = new List<BookingDTO>();
            foreach (var booking in bookingList)
            {
                var dto = _mapper.Map<BookingDTO>(booking);
                dto.CustomerName = booking.Customer?.FullName ?? booking.CustomerNameSnapshot ?? "";
                dto.BarberName = booking.Barber?.FullName ?? "";
                dto.CustomerPhone = booking.Customer?.PhoneNumber ?? booking.CustomerPhoneSnapshot ?? "Unknown";
                dto.Items = _mapper.Map<List<BookingItemDTO>>(booking.BookingItems.ToList());
                dtos.Add(dto);
            }

            return new PaginationResponse<BookingDTO>(request.PageSize, request.PageIndex, totalCount, dtos);
        }
    }
}