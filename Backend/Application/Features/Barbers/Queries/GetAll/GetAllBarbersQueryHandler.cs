using Application.Features.Barbers.DTOs;
using AutoMapper;
using Domain.Entities;
using Domain.Repositories;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Application.Features.Barbers.Queries.GetAll
{
    public class GetAllBarbersQueryHandler : IRequestHandler<GetAllBarbersQuery, ErrorOr<List<BarberDTO>>>
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;

        public GetAllBarbersQueryHandler(
            UserManager<ApplicationUser> userManager,
            IUnitOfWork unitOfWork,
            IMapper mapper)
        {
            _userManager = userManager;
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public async Task<ErrorOr<List<BarberDTO>>> Handle(GetAllBarbersQuery request, CancellationToken cancellationToken)
        {
            var barbers = await _userManager.GetUsersInRoleAsync("Barber");
            var activeBarbers = barbers.Where(b => !b.IsDeleted).ToList();
            var barberIds = activeBarbers.Select(b => b.Id).ToList();

            var workingHoursRepo = _unitOfWork.Repository<BarberWorkingHour, int>();
            var allWorkingHours = await workingHoursRepo.FindAsync(w => barberIds.Contains(w.BarberId));
            var hoursByBarber = allWorkingHours
                .GroupBy(w => w.BarberId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var dtos = new List<BarberDTO>();
            foreach (var barber in activeBarbers)
            {
                var dto = _mapper.Map<BarberDTO>(barber);
                var workingHours = hoursByBarber.TryGetValue(barber.Id, out var hours) ? hours : new List<BarberWorkingHour>();
                dto.WorkingHours = workingHours.Select(w => new BarberWorkingHourDTO
                {
                    Id = w.Id,
                    DayOfWeek = w.DayOfWeek,
                    DayName = w.DayOfWeek.ToString(),
                    OpeningTime = w.OpeningTime,
                    ClosingTime = w.ClosingTime,
                    IsClosed = w.IsClosed
                }).OrderBy(w => w.DayOfWeek).ToList();

                dtos.Add(dto);
            }

            return dtos;
        }
    }
}