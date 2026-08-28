using Application.Features.Auth.DTOs;
using AutoMapper;
using Domain.Entities;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Application.Interfaces;
using Error = ErrorOr.Error;
using Microsoft.Extensions.Configuration;
using System.IO;
using System;

namespace Application.Features.Auth.Commands.UpdateProfilePicture
{
    public class UpdateProfilePictureCommandHandler : IRequestHandler<UpdateProfilePictureCommand, ErrorOr<ProfilePictureResponseDTO>>
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IMapper _mapper;
        private readonly IConfiguration _configuration;
        private readonly IFileStorageService _fileStorageService;

        public UpdateProfilePictureCommandHandler(
            UserManager<ApplicationUser> userManager,
            IMapper mapper,
            IConfiguration configuration,
            IFileStorageService fileStorageService)
        {
            _userManager = userManager;
            _mapper = mapper;
            _configuration = configuration;
            _fileStorageService = fileStorageService;
        }

        public async Task<ErrorOr<ProfilePictureResponseDTO>> Handle(
            UpdateProfilePictureCommand request,
            CancellationToken cancellationToken)
        {
            // Get the user
            var user = await _userManager.FindByIdAsync(request.UserId);
            if (user == null)
            {
                return Error.NotFound("auth.user.not.found", "المستخدم ده مش موجود.");
            }

            // Validate file exists
            if (request.ProfilePictureFile == null || request.ProfilePictureFile.Length == 0)
            {
                return Error.Validation("image.empty", "مفيش ملف اتبعت.");
            }

            var oldProfilePictureUrl = user.ProfilePictureUrl;

            try
            {
                // Upload new image locally
                string fileName = _fileStorageService.Upload(request.ProfilePictureFile, "profiles");
                string baseUrl = _configuration["BaseURL"] ?? "http://localhost:5000";
                string fileUrl = _fileStorageService.GetFileUrl(fileName, "profiles", baseUrl);

                // Update user with new image URL
                user.ProfilePictureUrl = fileUrl;

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    // If database update fails, attempt to delete the uploaded image
                    _fileStorageService.Delete(fileName, "profiles");
                    return Error.Failure("image.update.failed", "فشل تحديث صورة الملف الشخصي.");
                }

                // Delete old image if it existed locally
                if (!string.IsNullOrEmpty(oldProfilePictureUrl))
                {
                    // Extract filename from URL
                    var uri = new Uri(oldProfilePictureUrl);
                    var oldFileName = Path.GetFileName(uri.LocalPath);
                    if (!string.IsNullOrEmpty(oldFileName))
                    {
                        _fileStorageService.Delete(oldFileName, "profiles");
                    }
                }

                return new ProfilePictureResponseDTO
                {
                    ProfilePictureUrl = user.ProfilePictureUrl,
                    Message = "تم تحديث صورة الملف الشخصي بنجاح."
                };
            }
            catch (Exception ex)
            {
                return Error.Failure("image.upload.exception", $"حصل مشكلة أثناء الرفع: {ex.Message}");
            }
        }
    }
}