using Domain.Entities;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Application.Interfaces;
using Error = ErrorOr.Error;
using System;
using System.IO;

namespace Application.Features.Auth.Commands.DeleteProfilePicture
{
    public class DeleteProfilePictureCommandHandler : IRequestHandler<DeleteProfilePictureCommand, ErrorOr<Success>>
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IFileStorageService _fileStorageService;

        public DeleteProfilePictureCommandHandler(UserManager<ApplicationUser> userManager, IFileStorageService fileStorageService)
        {
            _userManager = userManager;
            _fileStorageService = fileStorageService;
        }

        public async Task<ErrorOr<Success>> Handle(
            DeleteProfilePictureCommand request,
            CancellationToken cancellationToken)
        {
            // Get the user
            var user = await _userManager.FindByIdAsync(request.UserId);
            if (user == null)
            {
                return Error.NotFound("auth.user.not.found", "المستخدم ده مش موجود.");
            }

            // Check if user has a profile picture
            if (string.IsNullOrEmpty(user.ProfilePictureUrl))
            {
                return Error.NotFound("image.not.found", "المستخدم معندوش صورة شخصية.");
            }

            var oldProfilePictureUrl = user.ProfilePictureUrl;

            try
            {
                // Clear the URL from user via domain method first
                user.UpdateProfilePicture(null);

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    return Error.Failure("image.delete.failed", "فشل مسح الصورة الشخصية.");
                }

                // Delete from local storage only after DB update succeeds
                try
                {
                    var uri = new Uri(oldProfilePictureUrl);
                    var fileName = Path.GetFileName(uri.LocalPath);
                    
                    if (!string.IsNullOrEmpty(fileName))
                    {
                        _fileStorageService.Delete(fileName, "profiles");
                    }
                }
                catch
                {
                    // Ignore physical file deletion error since DB is already updated
                }

                return Result.Success;
            }
            catch (Exception ex)
            {
                return Error.Failure("image.delete.exception", $"حصل مشكلة: {ex.Message}");
            }
        }
    }
}