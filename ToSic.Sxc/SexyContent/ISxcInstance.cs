﻿using System.Web;
using ToSic.Eav.Apps;
using ToSic.SexyContent.DataSources;

namespace ToSic.SexyContent
{
    public interface ISxcInstance
    {
        /// <summary>
        /// The app relevant to this instance - contains much more material like
        /// app-path or all the data existing in this app
        /// </summary>
        App App { get; }

        /// <summary>
        /// The data-in of this instance. 
        /// It is either the data coming out of the module-instance (based on content/presentation etc.) or it's the data provided through the query/pipeline.
        /// </summary>
         ViewDataSource Data { get; }


        /// <summary>
        /// this is the internally assigned content-group to this instance
        /// it can be null, when no content group has been created yet
        /// </summary>
        //ContentGroup ContentGroup { get; }

        Template Template { get; }


        HtmlString Render();

    }
}
