﻿using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.IO;
using System.Data;
using DotNetNuke;
using DotNetNuke.Common.Utilities;
using ToSic.SexyContent;

namespace ToSic.SexyContent
{
    public partial class EditTemplate : DotNetNuke.Entities.Modules.PortalModuleBase
    {
        SexyContent Sexy;

        private bool ModeIsEdit { get { return !String.IsNullOrEmpty(Request.QueryString[SexyContent.TemplateID]); } }
        private int TemplateID { get { return Convert.ToInt32(Request.QueryString[SexyContent.TemplateID]); } }
        private Template Template;

        /// <summary>
        /// Initialize the template if edit mode is active
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        protected void Page_Init(object sender, EventArgs e)
        {
            Sexy = new SexyContent(false, new int?(),
                                   Request.QueryString.AllKeys.Contains("AppID")
                                       ? int.Parse(Request.QueryString["AppID"])
                                       : new int?());

            if (ModeIsEdit)
                Template = Sexy.TemplateContext.GetTemplate(TemplateID);
        }

        /// <summary>
        /// Set values in the form if edit mode is active
        /// Set DotNetNuke modal window NavigateUrl for cancel link
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        protected void Page_Load(object sender, EventArgs e)
        {
            // set DotNetNuke modal window Url for cancel link
            hlkCancel.NavigateUrl = EditUrl(PortalSettings.ActiveTab.TabID, SexyContent.ControlKeys.ManageTemplates, true, "mid=" + ModuleId);

            InitializeForm();

            // Set localized Error Messages for Validators
            valTemplateName.ErrorMessage = LocalizeString("valTemplateName.ErrorMessage");
            valTemplateFile.ErrorMessage = LocalizeString("valTemplateFile.ErrorMessage");
            //valContentType.ErrorMessage = LocalizeString("valContentType.ErrorMessage");
            valTemplateFileName.ErrorMessage = LocalizeString("valTemplateFileName.ErrorMessage");

            pnlSeparateContentPresentation.Visible = chkSeparateContentPresentation.Checked;
        }

        /// <summary>
        /// Set values in the form if edit mode is active, or fill available values
        /// </summary>
        protected void InitializeForm()
        {

            if (Page.IsPostBack)
            {
                pnlListConfiguration.Visible = chkEnableList.Checked;
                return;
            }

            // DataBind Template Locations
            ddlTemplateLocations.Items.Add(new ListItem(LocalizeString("TemplateLocationPortalFileSystem.Text"), SexyContent.TemplateLocations.PortalFileSystem));
            ddlTemplateLocations.Items.Add(new ListItem(LocalizeString("TemplateLocationHostFileSystem.Text"), SexyContent.TemplateLocations.HostFileSystem));
            // ToDo: (future version) add DB as Location

            // Fill form with values if in edit mode
            if (ModeIsEdit)
            {
                txtTemplateName.Text = Template.Name;
                ddlTemplateLocations.SelectedValue = Template.Location;
                ddlTemplateTypes.SelectedValue = Template.Type;
                chkHidden.Checked = Template.IsHidden;
                chkEnableList.Checked = Template.UseForList;
                hlkTemplateMetaData.Visible = true;
                pnlListConfiguration.Visible = chkEnableList.Checked;

                string ReturnUrl = Request.Url.AbsoluteUri;
                hlkTemplateMetaData.NavigateUrl = Sexy.GetMetaDataEditUrl(TabId, ModuleId, ReturnUrl, PortalSettings, this, SexyContent.TemplateMetaDataAttributeSetStaticName, Sexy.SexyContentTemplateAssignmentObjectTypeID, TemplateID);

                // Set ContentType / Demo Entity Selectors
                SetTemplateDefaultSelector(Template.TemplateID, ctrContentType);
                SetTemplateDefaultSelector(Template.TemplateID, ctrPresentationType);
                SetTemplateDefaultSelector(Template.TemplateID, ctrListContentType);
                SetTemplateDefaultSelector(Template.TemplateID, ctrListPresentationType);

                chkSeparateContentPresentation.Checked = pnlSeparateContentPresentation.Visible = ctrPresentationType._ContentTypeID > 0;
            }

            // Bind template files dropdown
            BindTemplateFiles(ddlTemplateTypes.SelectedValue, ddlTemplateLocations.SelectedValue, ddlTemplateFiles);

            // Set value of demo-content and template file dropdown if in edit mode
            if (ModeIsEdit)
            {
                ddlTemplateFiles.SelectedValue = Template.Path;
            }
        }

        /// <summary>
        /// After the Update button is clicked, updates the template or creates a new one,
        /// depending if in edit mode or not.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        protected void btnUpdate_Click(object sender, EventArgs e)
        {

            if (ModeIsEdit)
            {
                Template.AttributeSetID = ctrContentType.ContentTypeID.Value;
                Template.DemoEntityID = ctrContentType.DemoEntityID;
                Template.Location = ddlTemplateLocations.SelectedValue;
                Template.Type = ddlTemplateTypes.SelectedValue;
                if (pnlSelectTemplateFile.Visible)
                    Template.Path = ddlTemplateFiles.SelectedValue;
                else
                    Sexy.CreateTemplateFileIfNotExists(txtTemplateFileName.Text, Template, Server, LocalizeString("NewTemplateFile.DefaultText"));
                Template.SysModifiedBy = UserId;
                Template.SysModified = DateTime.Now;
                Template.Script = "";
                Template.Name = txtTemplateName.Text;
                Template.IsHidden = chkHidden.Checked;
                Template.UseForList = chkEnableList.Checked;

                Sexy.TemplateContext.UpdateTemplate(Template);
            }
            else
            {
                Template = Sexy.TemplateContext.GetNewTemplate();
                Template.PortalID = this.PortalId;
                Template.AttributeSetID = ctrContentType.ContentTypeID.Value;
                Template.DemoEntityID = ctrContentType.DemoEntityID;
                Template.Location = ddlTemplateLocations.SelectedValue;
                Template.Type = ddlTemplateTypes.SelectedValue;
                if (pnlSelectTemplateFile.Visible)
                    Template.Path = ddlTemplateFiles.SelectedValue;
                else
                    Sexy.CreateTemplateFileIfNotExists(txtTemplateFileName.Text, Template, Server, LocalizeString("NewTemplateFile.DefaultText"));
                Template.SysCreatedBy = UserId;
                Template.SysModifiedBy = UserId;
                Template.Script = "";
                Template.Name = txtTemplateName.Text;
                Template.IsHidden = chkHidden.Checked;
                Template.UseForList = chkEnableList.Checked;

                Sexy.TemplateContext.AddTemplate(Template);
            }

            if (!chkSeparateContentPresentation.Checked)
                ctrPresentationType.ContentTypeID = new int?();

            // Add template configuration entities for presentation, list header content type, list content, etc.    
            Sexy.CreateOrUpdateTemplateDefault(Template.TemplateID, ContentGroupItemType.Presentation.ToString("F"), ctrPresentationType.ContentTypeID, ctrPresentationType.DemoEntityID);
            Sexy.CreateOrUpdateTemplateDefault(Template.TemplateID, ContentGroupItemType.ListContent.ToString("F"), ctrListContentType.ContentTypeID, ctrListContentType.DemoEntityID);
            Sexy.CreateOrUpdateTemplateDefault(Template.TemplateID, ContentGroupItemType.ListPresentation.ToString("F"), ctrListPresentationType.ContentTypeID, ctrListPresentationType.DemoEntityID);

            // Redirect to the manage templates control
            string RedirectUrl = DotNetNuke.Common.Utilities.UrlUtils.PopUpUrl(DotNetNuke.Common.Globals.NavigateURL(SexyContent.ControlKeys.ManageTemplates, "mid", ModuleId.ToString()), this, PortalSettings, false, true);
            Response.Redirect(RedirectUrl);
        }

        protected void SetTemplateDefaultSelector(int TemplateID, ContentTypeAndDemoSelector Selector)
        {
            var ItemType = Selector.ItemType;
            var TemplateDefault = Sexy.GetTemplateDefault(TemplateID, ItemType);

            if (TemplateDefault != null)
            {
                Selector.ContentTypeID = TemplateDefault.ContentTypeID;
                Selector.DemoEntityID = TemplateDefault.DemoEntityID;
            }

            Selector.ItemType = ItemType;
            Selector.Enabled = !Sexy.IsTemplateDefaultInUse(TemplateID, ItemType);
        }

        protected void btnCreateTemplateFile_Click(object sender, EventArgs e)
        {
            pnlSelectTemplateFile.Visible = false;
            valTemplateFile.Enabled = false;
            pnlCreateTemplateFile.Visible = true;
            valTemplateFileName.Enabled = true;

            if(!UserInfo.IsSuperUser)
                ddlTemplateLocations.Items.Remove(ddlTemplateLocations.Items.FindByValue(SexyContent.TemplateLocations.HostFileSystem));
            
            string ProposedTemplateFile = "";
            if(ddlTemplateTypes.SelectedValue == "C# Razor" || ddlTemplateTypes.SelectedValue == "VB Razor")
                ProposedTemplateFile += "_";
            
            ProposedTemplateFile += txtTemplateName.Text;

            switch (ddlTemplateTypes.SelectedValue)
            {
                case "C# Razor":
                    ProposedTemplateFile += ".cshtml";
                    break;
                case "VB Razor":
                    ProposedTemplateFile += ".vbhtml";
                    break;
                default:
                    ProposedTemplateFile += ".html";
                    break;
            }

            txtTemplateFileName.Text = ProposedTemplateFile;
        }

        /// <summary>
        /// Bind the content types if the template location dropdown changed
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        protected void ddlTemplateLocations_SelectedIndexChanged(object sender, EventArgs e)
        {
            BindTemplateFiles(ddlTemplateTypes.SelectedValue, ddlTemplateLocations.SelectedValue, ddlTemplateFiles);
        }

        /// <summary>
        /// Bind template files if the template type changed
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        protected void ddlTemplateTypes_SelectedIndexChanged(object sender, EventArgs e)
        {
            BindTemplateFiles(ddlTemplateTypes.SelectedValue, ddlTemplateLocations.SelectedValue, ddlTemplateFiles);
        }

        /// <summary>
        /// Bind the template files from the given template location
        /// </summary>
        /// <param name="TemplateType">The template type</param>
        /// <param name="TemplateLocation">The template location</param>
        /// <param name="TemplateDropDown">The template dropdown to databind</param>
        protected void BindTemplateFiles(string TemplateType, string TemplateLocation, DropDownList TemplateDropDown)
        {
            TemplateDropDown.DataSource = Sexy.GetTemplateFiles(Server, PortalSettings, TemplateType, TemplateLocation);
            TemplateDropDown.DataBind();
        }
    }
}