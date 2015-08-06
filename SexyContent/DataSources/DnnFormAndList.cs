﻿using System.Data;
using DotNetNuke.Common.Utilities;
using DotNetNuke.Modules.UserDefinedTable;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using DotNetNuke.Services.Journal;
using ToSic.Eav;
using ToSic.Eav.DataSources;
using ToSic.Eav.ValueProvider;

namespace ToSic.SexyContent.DataSources
{
    /// <summary>
    /// Delivers UDT-data (now known as Form and List) to the templating engine
    /// </summary>
    [PipelineDesigner]
    public class DnnFormAndList : BaseDataSource
    {
        private DataTableDataSource DtDs;

        #region Configuration-properties

        private const string ModuleIdKey = "ModuleId";
        private const string TitleFieldKey = "TitleField";
        private const string ContentTypeKey = "ContentType";
        private const string EntityTitleDefaultKeyToken = "[Settings:TitleFieldName]";
        private const string FnLModuleIdDefaultToken = "[Settings:ModuleId||0]";
        private const string ContentTypeDefaultToken = "[Settings:ContentTypeName||FnL]";

        /// <summary>
        /// Gets or sets the FnL ModuleID containing the data
        /// </summary>
        public int ModuleId
        {
            get { return int.Parse(Configuration[ModuleIdKey]); }
            set { Configuration[ModuleIdKey] = value.ToString(); }
        }

        /// <summary>
        /// Gets or sets the Name of the Title Attribute of the Source DataTable
        /// </summary>
        public string TitleField
        {
            get { return Configuration[TitleFieldKey]; }
            set { Configuration[TitleFieldKey] = value; }
        }

        /// <summary>
        /// Gets or sets the Name of the ContentType Attribute 
        /// </summary>
        public string ContentType 
        {
            get { return Configuration[ContentTypeKey]; }
            set { Configuration[ContentTypeKey] = value; }
        }
        #endregion

        // Todo:
        // - Could also supply modified/created dates if needed from the FnL...

        /// <summary>
        /// Initializes a new instance of FormAndListDataSource class
        /// </summary>
        public DnnFormAndList()
        {
            Out.Add(DataSource.DefaultStreamName, new DataStream(this, DataSource.DefaultStreamName, GetEntities, GetList));
            Configuration.Add(ModuleIdKey, FnLModuleIdDefaultToken);
            Configuration.Add(TitleFieldKey, EntityTitleDefaultKeyToken);
            Configuration.Add(ContentTypeKey, ContentTypeDefaultToken);
        }


        private void LoadFnL()
        {
             EnsureConfigurationIsLoaded();

            // Preferred way in Form and List
            var udt = new UserDefinedTableController();
            var ds = udt.GetDataSet(ModuleId);
            DtDs = DataSource.GetDataSource<DataTableDataSource>(valueCollectionProvider: ConfigurationProvider);
            DtDs.Source = ds.Tables["Data"];
            DtDs.EntityIdField = "UserDefinedRowId";         // default column created by UDT
            DtDs.ContentType = ContentType;

            // clean up column names if possible, remove spaces in the column-names
            for (var i = 0; i < DtDs.Source.Columns.Count; i++)
                DtDs.Source.Columns[i].ColumnName = DtDs.Source.Columns[i].ColumnName
                    .Replace(" ", "");

            // Set the title-field - either the configured one, or if missing, just the first column we find
            if (string.IsNullOrWhiteSpace(TitleField))
                TitleField = DtDs.Source.Columns[1].ColumnName;  
            DtDs.TitleField = TitleField;
        }

        /// <summary>
        /// Internal helper that returns the entities - actually just retrieving them from the attached Data-Source
        /// </summary>
        /// <returns></returns>
        private IDictionary<int, IEntity> GetEntities()
        {
            // if not initialized, do that first
            if (DtDs == null)
                LoadFnL();

            return DtDs["Default"].List;
        }

        /// <summary>
        /// Internal helper that returns the entities - actually just retrieving them from the attached Data-Source
        /// </summary>
        /// <returns></returns>
        private IEnumerable<IEntity> GetList()
        {
            // if not initialized, do that first
            if (DtDs == null)
                LoadFnL();

            return DtDs["Default"].LightList;
        }
    }
}
