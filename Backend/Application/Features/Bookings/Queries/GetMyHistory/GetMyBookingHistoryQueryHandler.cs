using Application.Common.Pagination;
using Application.Features.Bookings.DTOs;
using AutoMapper;
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

namespace Application.Features.Bookings.Queries.GetMyHistory
{
    public class GetMyBookingHistoryQueryHandler : IRequestHandler<GetMyBookingHistoryQuery, ErrorOr<PaginationResponse<BookingDTO>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;

        public GetMyBookingHistoryQueryHandler(
            IUnitOfWork unitOfWork,
            IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public async Task<ErrorOr<PaginationResponse<BookingDTO>>> Handle(GetMyBookingHistoryQuery request, CancellationToken cancellationToken)
        {
            var bookingRepo = _unitOfWork.Repository<Booking, int>();

            var query = bookingRepo.GetIQueryable()
                .Include(b => b.Customer)
                .Include(b => b.Barber)
                .Include(b => b.BookingItems)
                .Where(b => b.CustomerId == request.CustomerId)
                .AsNoTracking();

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
                dto.Items = _mapper.Map<List<BookingItemDTO>>(booking.BookingItems.ToList());
                dtos.Add(dto);
            }

            return new PaginationResponse<BookingDTO>(request.PageSize, request.PageIndex, totalCount, dtos);
        }
    }
}