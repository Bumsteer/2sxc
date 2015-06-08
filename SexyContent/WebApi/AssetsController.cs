﻿using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;
using System.Web.Http;
using DotNetNuke.Security;
using DotNetNuke.Services.FileSystem;
using DotNetNuke.Web.Api;
using ToSic.Eav;
using ToSic.SexyContent.Serializers;

namespace ToSic.SexyContent.WebApi
{
    /// <summary>
    /// Direct access to app-content items, simple manipulations etc.
    /// Should check for security at each standard call - to see if the current user may do this
    /// Then we can reduce security access level to anonymous, because each method will do the security check
    /// todo: security
    /// </summary>
    [SupportedModules("2sxc,2sxc-app")]
    [DnnModuleAuthorize(AccessLevel = SecurityAccessLevel.Admin)]
    public class AssetsController : SxcApiController
    {
        // todo: centralize once it works
        public const string ToAMCRootFolder = "2amc";
        public const string ToAMCFolderTemplate = "2amc/[AppName]/[ShortGuid]/[FieldName]/";
        private string TwoAMCPermittedExtensions = "jpg,png,gif";
        public const int maxFileSizeMB = 10;

        #region Initializers

        private Eav.WebApi.WebApi _eavWebApi;

        public AssetsController()
        {
            Eav.Configuration.SetConnectionString("SiteSqlServer");
        }

        private void InitEavAndSerializer()
        {
            // Improve the serializer so it's aware of the 2sxc-context (module, portal etc.)
            _eavWebApi = new Eav.WebApi.WebApi(App.AppId);
            ((Serializer) _eavWebApi.Serializer).Sxc = Sexy;
        }

        #endregion


        [HttpPost]
        [HttpPut]
        public dynamic Upload(int id, string field)
        {
            // get the entity
            var ent = App.Data["Default"].List[id];
            return Upload(ent, field);
        }

        [HttpPost]
        [HttpPut]
        public dynamic Upload(Guid guid, string field)
        {
            throw new NotImplementedException();
        }

        private dynamic Upload(IEntity ent, string field)
        {
            // Check if the request contains multipart/form-data.
            if (!Request.Content.IsMimeMultipartContent())
                throw new HttpResponseException(HttpStatusCode.UnsupportedMediaType);

            // check dnn security
            if (!DotNetNuke.Security.Permissions.ModulePermissionController.CanEditModuleContent(Dnn.Module))
                throw new HttpResponseException(HttpStatusCode.Forbidden);
            // return new UploadResult { Success = false, Error = App.Resources.UploadNoPermission };

            // check if this field exists and is actually a file-field
            if (!ent.Attributes.ContainsKey(field) || ent.Attributes[field].Type != "Hyperlink")
                throw new HttpResponseException(Request.CreateResponse(HttpStatusCode.BadRequest,
                    "Requested field '" + field + "' type doesn't allow upload"));// { HttpStatusCode = HttpStatusCode.BadRequest });

            try
            {
                var folder = Folder(ent.EntityGuid, field);
                var filesCollection = HttpContext.Current.Request.Files;
                if (filesCollection.Count > 0)
                {
                    var originalFile = filesCollection[0];

                    // Check file size and extension
                    var extension = Path.GetExtension(originalFile.FileName).ToLower().Replace(".", "");
                    if (!TwoAMCPermittedExtensions.Contains(extension))
                        throw new HttpResponseException(HttpStatusCode.UnsupportedMediaType);

                    if (originalFile.ContentLength > (1024*1024*maxFileSizeMB))
                        return new UploadResult {Success = false, Error = App.Resources.UploadFileSizeLimitExceeded};

                    var fileName = originalFile.FileName;

                    // Make sure the image does not exist yet (change file name)
                    for (int i = 1; FileManager.Instance.FileExists(folder, Path.GetFileName(fileName)); i++)
                    {
                        fileName = Path.GetFileNameWithoutExtension(originalFile.FileName) + "-" + i +
                                   Path.GetExtension(originalFile.FileName);
                    }

                    // Everything is ok, add file
                    var dnnFile = FileManager.Instance.AddFile(folder, Path.GetFileName(fileName), originalFile.InputStream);

                    return new UploadResult {Success = true, Error = "", Filename = Path.GetFileName(fileName), FileId = dnnFile.FileId, FullPath = dnnFile.RelativePath};
                }

                return new UploadResult {Success = false, Error = "No image was uploaded."};
            }
            catch (Exception e)
            {
                return new UploadResult {Success = false, Error = e.Message};
            }


            string root = HttpContext.Current.Server.MapPath("~/App_Data");
            var provider = new MultipartFormDataStreamProvider(root);

            //try
            //{
            //    // Read the form data.
            //    // todo: try to get this async if possible!
            //    var task = Request.Content.ReadAsMultipartAsync(provider);
            //    task.Wait();

            //    //await Request.Content.ReadAsMultipartAsync(provider);
            //    //await TaskEx.Run(async () => await Request.Content.ReadAsMultipartAsync(provider));

            //    // This illustrates how to get the file names.
            //    foreach (MultipartFileData file in provider.FileData)
            //    {
            //        // Check file size and extension
            //        var extension = Path.GetExtension(file.Headers.ContentDisposition.FileName).ToLower().Replace(".", "");
            //        if (!allowedExtensions.Contains(extension))
            //        {
            //            throw new HttpResponseException(HttpStatusCode.Forbidden);
            //            // return new UploadResult { Success = false, Error = App.Resources.UploadExtensionNotAllowed };
            //        }
            //        // todo: save it
            //        // Trace.WriteLine(file.Headers.ContentDisposition.FileName);
            //        // Trace.WriteLine("Server file path: " + file.LocalFileName);
            //    }
            //    return Request.CreateResponse(HttpStatusCode.OK);
            //}
            //catch (System.Exception e)
            //{
            //    return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, e);
            //}
        }

        public class UploadResult
        {
            public bool Success { get; set; }
            public string Error { get; set; }
            public string Filename { get; set; }
            public int FileId { get; set; }
            public string FullPath { get; set; }
        }



        private IFolderInfo _folder;

        /// <summary>
        /// Get the folder specified in App.Settings (BasePath) combined with the module's ID
        /// Will create the folder if it does not exist
        /// </summary>
        public IFolderInfo Folder(Guid entityGuid, string fieldName)
        {

            if (_folder == null)
            {
                var folderManager = FolderManager.Instance;

                var basePath = ToAMCRootFolder;
                // todo:idea that it would auto-take a setting from app-settings if it exists :)
                basePath += "/" + App.Name; // + "/" + GuidCompress();
                var path = basePath + "/" + GuidCompress(entityGuid) + "/" + fieldName;// + Dnn.Module.ModuleID;

                // Create base folder if not exists
                if (!folderManager.FolderExists(Dnn.Portal.PortalId, basePath))
                    folderManager.AddFolder(Dnn.Portal.PortalId, basePath);

                // Create images folder for this module if not exists
                if (!folderManager.FolderExists(Dnn.Portal.PortalId, path))
                    folderManager.AddFolder(Dnn.Portal.PortalId, path);

                _folder = folderManager.GetFolder(Dnn.Portal.PortalId, path);
            }

            return _folder;
        }


        #region Guid helpers
        private string GuidCompress(Guid newGuid)
        {
            string modifiedBase64 = Convert.ToBase64String(newGuid.ToByteArray())
                .Replace('+', '-').Replace('/', '_') // avoid invalid URL characters
                .Substring(0, 22);      // truncate trailing "==" characters
            return modifiedBase64;
        }

        private Guid GuidUncompress(string shortGuid)
        {
            string base64 = shortGuid.Replace('-', '+').Replace('_', '/') + "==";
            Byte[] bytes = Convert.FromBase64String(base64);
            return new Guid(bytes);
        }
        #endregion
    }
}
