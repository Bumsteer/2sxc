﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using ToSic.SexyContent.ImportExport;

namespace ToSic.SexyContent.WebApi
{
    public class ImportResult
    {
        public bool Succeeded;

        public List<ExportImportMessage> Messages;

        public ImportResult()
        {
            Messages = new List<ExportImportMessage>();
        }
    }

}