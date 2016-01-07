(function() { // TN: this is a helper construct, research iife or read https://github.com/johnpapa/angularjs-styleguide#iife

    angular.module("Adam", [
        "SxcServices",
        "EavConfiguration", // config
        "EavServices", // multi-language stuff
        //"InitSxcParametersFromUrl"
            //"SxcTemplates", // inline templates
            //"EavAdminUi", // dialog (modal) controller
            //"SxcFilters", // for inline unsafe urls
            //"ContentTypesApp",
            //"PipelineManagement",
            //"TemplatesApp",
            //"ImportExportApp",
            //"AppSettingsApp",
            //"SystemSettingsApp",
            //"WebApiApp"
        ])
        //.config(function($translatePartialLoaderProvider) {
        //    // ensure the language pack is loaded
        //    $translatePartialLoaderProvider.addPart("sxc-admin");
        //})
        //.controller("AppMain", MainController);
        ;

} ());
angular.module("Adam")
    .factory("adamSvc", ["$http", "eavConfig", "sxc", "svcCreator", "appRoot", function($http, eavConfig, sxc, svcCreator, appRoot) {

        // Construct a service for this specific appId
        return function createSvc(contentType, entityGuid, field, subfolder) {
            var svc = {
                url: sxc.resolveServiceUrl("app-content/" + contentType + "/" + entityGuid + "/" + field),
                subfolder: subfolder,
                folders: [],
                adamRoot: appRoot.substr(0, appRoot.indexOf("2sxc"))
            };

            // get the correct url for uploading as it is needed by external services (dropzone)
            svc.uploadUrl = function(targetSubfolder) {
                return (targetSubfolder === "")
                    ? svc.url
                    : svc.url + "?subfolder=" + targetSubfolder;
            };

            // extend a json-response with a path (based on the adam-root) to also have a fullPath
            svc.addFullPath = function addFullPath(value, key) {
                value.fullPath = svc.adamRoot + value.Path;
            };

            svc = angular.extend(svc, svcCreator.implementLiveList(function getAll() {
                return $http.get(svc.url + "/items", { params: { subfolder: svc.subfolder } })
                    .then(function (result) {
                        angular.forEach(result.data, svc.addFullPath);
                        return result;
                    });
            }));

            // create folder
            svc.addFolder = function add(newfolder) {
                return $http.post(svc.url + "/folder", {}, { params: { subfolder: svc.subfolder, newFolder: newfolder } })
                    .then(svc.liveListReload);
            };

            svc.goIntoFolder = function(childFolder) {
                svc.folders.push(childFolder);
                var pathParts = childFolder.Path.split("/");
                var subPath = "";
                for (var c = 0; c < svc.folders.length; c++)
                    subPath = pathParts[pathParts.length - c - 2] + "/" + subPath;

                subPath = subPath.replace("//", "/");
                if (subPath[subPath.length - 1] === "/")
                    subPath = subPath.substr(0, subPath.length - 1);

                childFolder.Subfolder = subPath;

                // now assemble the correct subfolder based on the folders-array
                svc.subfolder = subPath;
                svc.liveListReload();
                return subPath;
            };

            svc.goUp = function() {
                if (svc.folders.length > 0)
                    svc.folders.pop();
                if (svc.folders.length > 0) {
                    svc.subfolder = svc.folders[svc.folders.length - 1].Subfolder;
                } else {
                    svc.subfolder = "";
                }
                svc.liveListReload();
                return svc.subfolder;
            };

            // delete, then reload
            // IF verb DELETE fails, so I'm using get for now
            svc.delete = function del(item) {
                return $http.get(svc.url + "/delete", { params: { subfolder: svc.subfolder, isFolder: item.IsFolder, id: item.Id } })
                    .then(svc.liveListReload);
            };

            return svc;
        };
    }]);
(function () {
    /* jshint laxbreak:true */
    "use strict";

    var app = angular.module("Adam"); 

    // The controller for the main form directive
    app.controller("BrowserController", BrowserController);
    
    function BrowserController($scope, adamSvc, debugState, eavConfig, eavAdminDialogs, appRoot) {
        var vm = this;
        vm.debug = debugState;
        vm.contentTypeName = $scope.contentTypeName;
        vm.entityGuid = $scope.entityGuid;
        vm.fieldName = $scope.fieldName;
        vm.show = false;
        vm.subFolder = $scope.subFolder || "";
        vm.appRoot = appRoot;

        //$scope.showImagesOnly = ;
        vm.showImagesOnly = $scope.showImagesOnly = $scope.showImagesOnly || false;

        vm.folderDepth = (typeof $scope.folderDepth !== 'undefined' && $scope.folderDepth !== null)
            ? $scope.folderDepth
            : 2;
        vm.showFolders = !!vm.folderDepth;
        vm.allowAssetsInRoot = $scope.allowAssetsInRoot || true;
        vm.folderMetadataContentType = $scope.folderMetadataContentType || "";
        vm.metadataContentType = $scope.metadataContentType || "";
        vm.defaultMetadataContentType = vm.metadataContentType.split("\n")[0]; // first line is the rule for all


        vm.disabled = $scope.ngDisabled;
        vm.enableSelect = $scope.enableSelect || true;

        vm.activate = function () {
            if($scope.autoLoad)
                vm.toggle();
            if ($scope.registerSelf)
                $scope.registerSelf(vm);
        };


        // load svc...
        vm.svc = adamSvc(vm.contentTypeName, vm.entityGuid, vm.fieldName, vm.subFolder);

        // refresh - also used by callback after an upload completed
        vm.refresh = vm.svc.liveListReload;

        vm.get = function () {
            vm.items = vm.svc.liveList();
            vm.folders = vm.svc.folders;
        };

        vm.toggle = function toggle(newConfig) {
            var settingsChanged = false;
            if (newConfig) {
                settingsChanged = (vm.showImagesOnly !== newConfig.showImagesOnly);
                vm.showImagesOnly = newConfig.showImagesOnly;
            }
            vm.show = settingsChanged || !vm.show;      // if settings changed, always show
            if (vm.show)
                vm.get();
        };

        vm.openUpload = function() {
            vm.dropzone.openUpload();
        };

        vm.select = function (fileItem) {
            if (vm.disabled || !vm.enableSelect)
                return;
            $scope.updateCallback(fileItem);
        };

        vm.addFolder = function () {
            if (vm.disabled)
                return;
            var folderName = window.prompt("Folder Name?");
            if (folderName)
                vm.svc.addFolder(folderName)
                    .then(vm.refresh);
        };

        vm.del = function del(item) {
            if (vm.disabled)
                return;
            var ok = window.confirm("delete ok?");
            if (ok)
                vm.svc.delete(item);
        };

        //#region Folder Navigation
        vm.goIntoFolder = function (folder) {
            var subFolder = vm.svc.goIntoFolder(folder);
            vm.subFolder = subFolder;
        };

        vm.goUp = function () {
            vm.subFolder = vm.svc.goUp();
        };

        vm.currentFolderDepth = function() {
            return vm.svc.folders.length;
        };

        vm.allowCreateFolder = function() {
            return vm.svc.folders.length < vm.folderDepth;
        };

        //#endregion

        //#region Metadata
        vm.editFolderMetadata = function(item) {
            var items = [
                vm._itemDefinition(item, vm.folderMetadataContentType)
            ];

            eavAdminDialogs.openEditItems(items, vm.refresh);

        };

        // todo: move to service, shouldn't be part of the application
        vm._itemDefinition = function (item, metadataType) {
            var title = "Metadata"; // todo: i18n
            return item.MetadataId !== 0
                ? { EntityId: item.MetadataId, Title: title } // if defined, return the entity-number to edit
                : {
                    ContentTypeName: metadataType, // otherwise the content type for new-assegnment
                    Metadata: {
                        Key: (item.Type === "folder" ? "folder" : "file") + ":" + item.Id,
                        KeyType: "string",
                        TargetType: eavConfig.metadataOfCmsObject
                    },
                    Title: title,
                    Prefill: { EntityTitle: item.Name } // possibly prefill the entity title 
                };

        };

        //#endregion

        //#region icons
        vm.icons = {
            doc: "file-word",
            docx: "file-word",
            xls: "file-excel",
            xlsx: "file-excel",
            ppt: "file-powerpoint",
            pptx: "file-powerpoint",
            pdf: "file-pdf",
            mp3: "file-audio",
            avi: "file-video",
            mpg: "file-video",
            mpeg: "file-video",
            mov: "file-video",
            mp4: "file-video",
            zip: "file-archive",
            rar: "file-archive",
            txt: "file-text",
            html: "file-code",
            css: "file-code",
            xml: "file-code",
            xsl: "file-code",
            vcf: "user"

        };
        vm.icon = function (item) {
            var ext = item.Name.substr(item.Name.lastIndexOf(".") + 1).toLowerCase();
            return "icon-" + (vm.icons[ext] || "file");
        };
        //#endregion

        vm.activate();
    }
    BrowserController.$inject = ["$scope", "adamSvc", "debugState", "eavConfig", "eavAdminDialogs", "appRoot"];

})();

(function () {
    /* jshint laxbreak:true*/

    angular.module("Adam")
        .directive("adamBrowser", function() {
            return {
                restrict: "E",
                templateUrl: "adam/browser.html",

                //replace: true,
                transclude: false,
                require: "^dropzone",
                link: function postLink(scope, elem, attrs, dropzoneCtrl) {
                    // connect this adam to the dropzone
                    dropzoneCtrl.adam = scope.vm;       // so the dropzone controller knows what path etc.
                    scope.vm.dropzone = dropzoneCtrl;   // so we can require an "open file browse" dialog
                },
                scope: {
                    // Identity fields
                    contentTypeName: "=",
                    entityGuid: "=",
                    fieldName: "=",

                    // configuration general
                    subFolder: "=",
                    folderDepth: "=", 
                    metadataContentType: "=",
                    folderMetadataContentType: "=",
                    allowAssetsInRoot: "=",
                    showImagesOnly: "=",

                    // binding and cross-component communication
                    autoLoad: "=",
                    updateCallback: "=",
                    registerSelf: "=",

                    // basic functionality
                    enableSelect: "=",
                    ngDisabled: "="
                },
                controller: "BrowserController",
                controllerAs: "vm"
            };
        });
})();
(function() {
    /* jshint laxbreak:true*/
    angular.module("Adam")
        .directive("dropzoneUploadPreview", function() {
            return {
                restrict: "E",
                templateUrl: "adam/dropzone-upload-preview.html",
                replace: true,
                transclude: false
            };
        });
})();
/* js/fileAppDirectives */

angular.module("Adam")
    .directive("dropzone", ["sxc", "tabId", "dragClass", "adamSvc", function (sxc, tabId, dragClass, adamSvc) {
        return {
            restrict: "C",
            link: function(scope, element, attrs, controller) {
                var header = scope.$parent.to.header;
                var field = scope.$parent.options.key;
                var entityGuid = header.Guid;
                var svc = adamSvc(header.ContentTypeName, entityGuid, field, "");
                var url = svc.url;

                var config = {
                    url: url,
                    urlRoot: url,
                    maxFilesize: 100,
                    paramName: "uploadfile",
                    maxThumbnailFilesize: 10,

                    headers: {
                        "ModuleId": sxc.id,
                        "TabId": tabId
                    },

                    dictDefaultMessage: "",
                    addRemoveLinks: false,
                    previewsContainer: ".field-" + field.toLowerCase() + " .dropzone-previews",
                    // we need a clickable, because otherwise the entire area is clickable. so i'm just making the preview clickable, as it's not important
                    clickable: ".field-" + field.toLowerCase() + " .invisible-clickable" // " .dropzone-adam"
                };



                var eventHandlers = {
                    'addedfile': function(file) {
                        scope.$apply(function() {
                            scope.uploading = true;
                        });
                    },

                    "processing": function(file) {
                        this.options.url = svc.uploadUrl(controller.adam.subFolder);
                    },

                    'success': function(file, response) {
                        if (response.Success) {
                            svc.addFullPath(response);  // calculate additional infos
                            scope.$parent.afterUpload(response);
                        } else {
                            alert("Upload failed because: " + response.Error);
                        }
                    },

                    "queuecomplete": function(file) {
                        if (this.getUploadingFiles().length === 0 && this.getQueuedFiles().length === 0) {
                            scope.uploading = false;
                            controller.adam.refresh();
                        }
                    }
                };

                var dropzone = new Dropzone(element[0], config);

                angular.forEach(eventHandlers, function(handler, event) {
                    dropzone.on(event, handler);
                });

                scope.processDropzone = function() {
                    dropzone.processQueue();
                };

                scope.resetDropzone = function() {
                    dropzone.removeAllFiles();
                };

                controller.openUpload = function() {
                    dropzone.hiddenFileInput.click();
                };
            },

            // This controller is needed, because it needs an API which can talk to other directives
            controller: function() {
                var vm = this;
                vm.adam = {
                    show: false,
                    subFolder: "",
                    refresh: function () { }
                };
            }
        };
    }]);

(function () {
	"use strict";

	/* This app registers all field templates for 2sxc in the angularjs sxcFieldTemplates app */

    angular.module("sxcFieldTemplates", [
        "formly",
        "formlyBootstrap",
        "ui.bootstrap",
        "ui.tree",
        "2sxc4ng",
        "SxcEditTemplates",     // temp - was because of bad template-converter, remove once I update grunt
        "EavConfiguration",
        "SxcServices",
        "Adam",
        //"ui.tinymce",   // connector to tiny-mce for angular
        "oc.lazyLoad"   // needed to lazy-load the MCE editor from the cloud
    ]);

})();
// This is the service which allows opening dnn-bridge dialogs and processes the results

angular.module("sxcFieldTemplates")
    .factory("dnnBridgeSvc", ["$modal", "$http", "eavConfig", "sxc", function($modal, $http, eavConfig, sxc) {
        var svc = {};
        svc.open = function open(type, oldValue, params, callback) {
            var template = type === "pagepicker" ? "pagepicker" : "filemanager";

            var connector = {
                params: params,
                valueChanged: callback,
                dialogType: type
            };

            connector.valueChanged = function valueChanged(value, type) {
                connector.modalInstance.close();
                callback(value, type);
            };

            connector.params.CurrentValue = oldValue;

            connector.modalInstance = $modal.open({
                templateUrl: "fields/dnn-bridge/hyperlink-default-" + template + ".html",
                resolve: {
                    bridge: function () {
                        return connector;
                    }
                },
                controller: ["$scope", "bridge", function ($scope, bridge) {
                    $scope.bridge = bridge;
                }],
                windowClass: "sxc-dialog-filemanager"
            });

            return connector.modalInstance;
        };

        // convert the url to a Id-code
        svc.convertPathToId = function(path, type) {
            var pathWithoutVersion = path.replace(/\?ver=[0-9\-]*$/gi, "");
            var promise = $http.get("dnn/Hyperlink/GetFileByPath?relativePath=" + encodeURIComponent(pathWithoutVersion));
            return promise;
        };

        // handle short-ID links like file:17
        svc.getUrlOfId = function(idCode) {
            var linkLowered = idCode.toLowerCase();
            if (linkLowered.indexOf("file:") !== -1 || linkLowered.indexOf("page:") !== -1)
                return $http.get("dnn/Hyperlink/ResolveHyperlink?hyperlink=" + encodeURIComponent(idCode));
            return null;
        };

        return svc;

    }]);

// this is in charge of the iframe which shows the dnn-bridge components

(function () {
	"use strict";

	angular.module("sxcFieldTemplates")


	.directive("webFormsBridge", ["sxc", "portalRoot", function (sxc, portalRoot) {
	    var webFormsBridgeUrl = portalRoot + "Default.aspx?tabid=" + $2sxc.urlParams.require("tid") + "&ctl=webformsbridge&mid=" + sxc.id + "&popUp=true";

		return {
			restrict: "A",
			scope: {
				type: "@bridgeType",
				bridge: "=webFormsBridge",
				bridgeSyncHeight: "@bridgeSyncHeight"
			},
			link: function (scope, elem, attrs) {

			    var params = "";
			    if (scope.bridge.params) {
			        params = Object.keys(scope.bridge.params).map(function (prop) {
			            if (scope.bridge.params[prop] === null || scope.bridge.params[prop] === '')
			                return;
			            return [prop, scope.bridge.params[prop]].map(encodeURIComponent).join("=");
			        }).join("&");
			    }

			    elem[0].src = webFormsBridgeUrl + "&type=" + scope.type + (scope.bridge.params ? "&" + params : "");
				elem.on("load", function () {					
					var w = elem[0].contentWindow || elem[0];
					w.connectBridge(scope.bridge);

					// Sync height
					if (scope.bridgeSyncHeight === "true") {
						
						var resize = function () {
							elem.css("height", "");
							elem.css("height", w.document.body.scrollHeight + "px");
						};

						//w.$(w).resize(resize); // Performance issues when uncommenting this line...
						resize();
						w.$(w.document).ready(function() {
							resize();
						});
						w.$(w.document).on('triggerbridgeresize', function () {
						    window.setTimeout(resize, 0);
						});

					}
				});
			}
		};
	}]);

})();

(function() {
    "use strict";

    angular.module("sxcFieldTemplates")
        .config(["formlyConfigProvider", function(formlyConfigProvider) {

            formlyConfigProvider.setType({
                name: "hyperlink-default",
                templateUrl: "fields/hyperlink/hyperlink-default.html",
                wrapper: ["eavLabel", "bootstrapHasError", "eavLocalization"],
                controller: "FieldTemplate-HyperlinkCtrl as vm"
            });
        }])
        .controller("FieldTemplate-HyperlinkCtrl", ["$modal", "$scope", "$http", "sxc", "adamSvc", "debugState", "dnnBridgeSvc", function ($modal, $scope, $http, sxc, adamSvc, debugState, dnnBridgeSvc) {

            var vm = this;
            vm.debug = debugState;
            vm.testLink = "";
            vm.checkImgRegEx = /(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*\.(?:jpg|jpeg|gif|png))(?:\?([^#]*))?(?:#(.*))?/i;

            vm.isImage = function() {
                var value = $scope.value;
                return vm.checkImgRegEx.test(vm.testLink);
            };
            vm.thumbnailUrl = function thumbnailUrl(size) {
                if (size === 1)
                    return vm.testLink + "?w=46&h=46&mode=crop";
                if (size === 2)
                    return vm.testLink + "?w=500&h=400&mode=max";
            };

            // Update test-link if necessary - both when typing or if link was set by dialogs
            $scope.$watch("value.Value", function(newValue, oldValue) {
                if (!newValue)
                    return;

                // handle short-ID links like file:17
                var promise = dnnBridgeSvc.getUrlOfId(newValue);
                if(promise)
                    promise.then(function (result) {
                        if (result.data) 
                            vm.testLink = result.data;
                    });
                else 
                    vm.testLink = newValue;
            });

            //#region dnn-bridge dialogs

            // the callback when something was selected
            vm.processResultOfDnnBridge = function(value, type) {
                $scope.$apply(function() {
                    if (!value) return;
                    
                    // Convert file path to file ID if type file is specified
                    if (type === "page") {
                        $scope.value.Value = "page:" + value.id;
                    }
                    if (type === "file" || type === "image") {
                        dnnBridgeSvc.convertPathToId(value, type)
                            .then(function(result) {
                                if (result.data)
                                    $scope.value.Value = "file:" + result.data.FileId;
                            });
                    }
                });
            };

            // open the dialog
            vm.openDialog = function (type) {
                dnnBridgeSvc.open(
                    type,
                    $scope.value.Value,
                    {
                        Paths: $scope.to.settings.merged ? $scope.to.settings.merged.Paths : "",
                        FileFilter: $scope.to.settings.merged ? $scope.to.settings.merged.FileFilter : ""
                    },
                    vm.processResultOfDnnBridge);
            };

            //#region new adam: callbacks only
            vm.registerAdam = function(adam) {
                vm.adam = adam;
            };
            vm.setValue = function(fileItem) {
                $scope.value.Value = "File:" + fileItem.Id;
            };
            $scope.afterUpload = vm.setValue;   // binding for dropzone
            vm.toggleAdam = function toggle() {
                vm.adam.toggle();
            };

            //#endregion


        }]);


})();

(function() {
    "use strict";

    angular.module("sxcFieldTemplates")
        .config(["formlyConfigProvider", function(formlyConfigProvider) {

            formlyConfigProvider.setType({
                name: "hyperlink-library",
                templateUrl: "fields/hyperlink/hyperlink-library.html",
                wrapper: ["eavLabel", "bootstrapHasError", "eavLocalization"],
                controller: "FieldTemplate-Library as vm"
            });

        }])
        .controller("FieldTemplate-Library", ["$modal", "$scope", "$http", "sxc", "adamSvc", "debugState", function($modal, $scope, $http, sxc, adamSvc, debugState) {

            var vm = this;
            vm.debug = debugState;
            vm.modalInstance = null;
            vm.testLink = "";

            //#region new adam: callbacks only
            vm.registerAdam = function(adam) {
                vm.adam = adam;
            };
            //vm.setValue = function(url) {
            //    $scope.value.Value = url;
            //};
            $scope.afterUpload = function(fileItem) {};

            vm.toggleAdam = function toggle() {
                vm.adam.toggle();
            };

            //#endregion


        }]);


})();

(function () {
	"use strict";

	/* This app registers all field templates for 2sxc in the angularjs sxcFieldTemplates app */

    angular.module("sxcFieldTemplates")
        .config(["formlyConfigProvider", function(formlyConfigProvider) {

            // for now identical with -adv, but later will change
            formlyConfigProvider.setType({
                name: "string-wysiwyg-adv",
                templateUrl: "fields/string/string-wysiwyg-adv.html",
                wrapper: ["eavLabel", "bootstrapHasError", "eavLocalization"]
            });


        }]);

})();

(function () {
	"use strict";

	/* This app registers all field templates for 2sxc in the angularjs sxcFieldTemplates app */

	angular.module("sxcFieldTemplates")

    .config(["formlyConfigProvider", function (formlyConfigProvider) {

        // for now identical with -adv, but later will change
		formlyConfigProvider.setType({
			name: "string-wysiwyg-dnn",
			templateUrl: "fields/string/string-wysiwyg-dnn.html",
			wrapper: ["eavLabel", "bootstrapHasError", "eavLocalization"],
			controller: "FieldTemplate-WysiwygCtrl as vm"
		});

        
	}])


	.controller("FieldTemplate-WysiwygCtrl", ["$scope", function ($scope) {

		var vm = this;

		// Everything the WebForms bridge (iFrame) should have access to
		vm.bridge = {
		    initialValue: "",
            initialReadOnly: false,
		    onChanged: function (newValue) {
				$scope.$apply(function () {
					$scope.value.Value = newValue;
				});
			},
			setValue: function (value) { vm.bridge.initialValue = value; },
			setReadOnly: function(readOnly) { vm.bridge.initialReadOnly = readOnly; }
		};

		$scope.$watch("value.Value", function (newValue, oldValue) {
			if (newValue !== oldValue)
				vm.bridge.setValue(newValue);
		});

		$scope.$watch("to.disabled", function (newValue, oldValue) {
			if (newValue !== oldValue)
				vm.bridge.setReadOnly(newValue);
		});

	}]);


})();

(function () {
	"use strict";

    // Register in Angular Formly
    angular.module("sxcFieldTemplates")
        .config(["formlyConfigProvider", function(formlyConfigProvider) {
            formlyConfigProvider.setType({
                name: "string-wysiwyg-tinymce",
                templateUrl: "fields/string/string-wysiwyg-tinymce.html",
                wrapper: ["eavLabel", "bootstrapHasError", "eavLocalization"],
                controller: "FieldWysiwygTinyMce as vm"
            });
        }])

        .controller("FieldWysiwygTinyMce", FieldWysiwygTinyMceController);

    function FieldWysiwygTinyMceController($scope, dnnBridgeSvc) {
        var vm = this;

        vm.activate = function () {

            var plugins = [
                "code",         // allow view / edit source
                "contextmenu",  // right-click menu for things like insert, etc.
                "autolink",     // automatically convert www.xxx links to real links
                "tabfocus",     // get in an out of the editor with tab
                "image",        // image button and image-settings
                "link",         // link button + ctrl+k to add link
                "autosave",     // temp-backups the content in case the browser crashes, allows restore
                "paste",        // enables paste as text
                "anchor",       // allows users to set an anchor inside the text
            ];
            $scope.tinymceOptions = {
                baseURL: "//cdn.tinymce.com/4",
                //onChange: function (e) {
                //    // put logic here for keypress and cut/paste changes
                //},
                inline: true, // use the div, not an iframe
                automatic_uploads: false, // we're using our own upload mechanism
                menubar: true, // don't add a second row of menus
                toolbar: " undo redo removeformat | styleselect | bold italic | h1 h2 hgroup | bullist numlist outdent indent "
                    + "| images linkgroup "
                    + "| code",
                plugins: plugins.join(" "),
                contextmenu: "link image adamimage",
                autosave_ask_before_unload: false,
                paste_as_text: true,
                

                // Url Rewriting in images and pages
                //convert_urls: false,  // don't use this, would keep the domain which is often a test-domain
                relative_urls: false, // keep urls with full path so starting with a "/" - otherwise it would rewrite them to a "../../.." syntax
                object_resizing: false, // don't allow manual scaling of images

                skin: "lightgray",
                theme: "modern",
                statusbar: true,    // doesn't work in inline :(
                setup: function(editor) {
                    vm.editor = editor;
                    addTinyMceToolbarButtons(editor, vm);

                    // make sure the model isn't dirty
                    var x = $scope.value.Value;

                    editor.on("init", function() {
                        var y = $scope.value.Value;
                    });
                    editor.on("dirty", function() {
                        var y = $scope.value.Value;
                    });
                    editor.on("loadcontent", function() {
                        var y = $scope.value.Value;
                    });
                }
            };
        };

        //#region new adam: callbacks only
        vm.registerAdam = function (adam) {
            vm.adam = adam;
        };


        vm.setValue = function (fileItem, modeImage) {
            if (modeImage === undefined)        // if not supplied, use the setting in the adam
                modeImage = vm.adamModeImage; 
            vm.editor.insertContent(modeImage
                ? "<img src=\"" + fileItem.fullPath + "\">"
                : "<a href=\"" + fileItem.fullPath + "\">" + fileItem.Name.substr(0, fileItem.Name.lastIndexOf(".")) + "</a>");
        };

        // this is the event called by dropzone as something is dropped
        $scope.afterUpload = function(fileItem) {   
            vm.setValue(fileItem, fileItem.Type === "image");
        };

        vm.toggleAdam = function toggle(imagesOnly) {
            vm.adamModeImage = imagesOnly;
            vm.adam.toggle({showImagesOnly: imagesOnly});
            $scope.$apply();
        };

        //#endregion

        //#region DNN stuff

        // open the dialog
        vm.openDnnDialog = function (type) {
            dnnBridgeSvc.open(type, "", { Paths: null, FileFilter: null }, vm.processResultOfDnnBridge);
        };

        // the callback when something was selected
        vm.processResultOfDnnBridge = function (value, type) {
            $scope.$apply(function () {
                if (!value) return;

                // Convert file path to file ID if type file is specified
                var promise = dnnBridgeSvc.getUrlOfId(type + ":" + (value.id || value.FileId)); // id on page, FileId on file
                if (promise)
                    promise.then(function (result) {
                        var previouslySelected = vm.editor.selection.getContent();

                        if (type === "file") {
                            var fileName = result.data.substr(result.data.lastIndexOf("/"));
                            fileName = fileName.substr(0, fileName.lastIndexOf("."));
                            vm.editor.insertContent("<a href=\"" + result.data + "\">" + (previouslySelected || fileName) + "</a>");
                        } else if (type === "image") {
                            vm.editor.insertContent("<img src=\"" + result.data + "\">");
                        } else { // page
                            vm.editor.insertContent("<a href=\"" + result.data + "\">" + (previouslySelected || value.name) + "</a>");
                        }
                    });

            });
        };

        //#endregion

        vm.activate();
    }
    FieldWysiwygTinyMceController.$inject = ["$scope", "dnnBridgeSvc"];

    function addTinyMceToolbarButtons(editor, vm) {

        editor.addButton("linkgroup",
        {
            type: "splitbutton",
            icon: "link",
            title: "Link",
            onclick: function() {
                editor.execCommand("mceLink");
            },
            menu: [
                { icon: "link", text: "web link", onclick: function() { editor.execCommand("mceLink"); } },
                { icon: "unlink", text: "remove link", onclick: function() { editor.execCommand("unlink"); } },
                { icon: "anchor", text: "set anchor", onclick: function() { editor.execCommand("mceAnchor"); } },
                {
                    text: "file in ADAM (recommended)",
                    icon: "newdocument",
                    onclick: function() {
                        vm.toggleAdam(false);
                    }
                }, {
                    text: "file in DNN",
                    icon: "newdocument",
                    onclick: function() {
                        vm.openDnnDialog("documentmanager");
                    }
                }, {
                    text: "page in DNN",
                    icon: "copy",
                    onclick: function() {
                        vm.openDnnDialog("pagepicker");
                    }
                }
            ]
        });

        editor.addButton("images", {
            type: "splitbutton",
            text: "",
            icon: "image",
            onclick: function() {
                vm.toggleAdam(true);
            },
            menu: [
                {
                    text: "from ADAM (recommended)",
                    icon: "image",
                    onclick: function() {
                        vm.toggleAdam(true);
                    }
                }, {
                    text: "from DNN (all files in DNN, slower)",
                    icon: "image",
                    onclick: function() {
                        vm.openDnnDialog("imagemanager");
                    }
                }, {
                    text: "Insert with url / edit image",
                    icon: "image",
                    onclick: function () { editor.execCommand("mceImage"); }

                },
                { icon: "alignleft", onclick: function() { editor.execCommand("JustifyLeft"); } },
                { icon: "aligncenter", onclick: function() { editor.execCommand("JustifyCenter"); } },
                { icon: "alignright", onclick: function() { editor.execCommand("JustifyRight"); } },
            ]
        });


        editor.addButton("adamimage", {
            text: "image from ADAM",
            icon: "image",
            onclick: function () {
                vm.toggleAdam(true);
            }
        });
        //editor.addButton("dnn", {
        //    type: "menubutton",
        //    text: "DNN",
        //    icon: "link",
        //    menu: [
        //        {
        //            text: "file from ADAM (automatic, recommended)",
        //            icon: "newdocument",
        //            onclick: function() {
        //                vm.toggleAdam();
        //            }
        //        }, {
        //            text: "file from DNN",
        //            icon: "newdocument custom glyphicon glyphicon-apple",
        //            onclick: function() {
        //                vm.openDnnDialog("documentmanager");
        //            }
        //        }, {
        //            text: "page in DNN",
        //            icon: "copy",
        //            onclick: function() {
        //                vm.openDnnDialog("pagepicker");
        //            }
        //        }
        //    ]
        //});

        // h1, h2, etc. buttons, inspired by http://blog.ionelmc.ro/2013/10/17/tinymce-formatting-toolbar-buttons/
        ["pre", "p", "code", "h1", "h2", "h3", "h4", "h5", "h6"].forEach(function (name) {
            editor.addButton(name, {
                tooltip: "Toggle " + name,
                text: name.toUpperCase(),
                onclick: function() { editor.execCommand("mceToggleFormat", false, name); },
                onPostRender: function() {
                    var self = this,
                        setup = function() {
                            editor.formatter.formatChanged(name, function(state) {
                                self.active(state);
                            });
                        };
                    var x = editor.formatter ? setup() : editor.on("init", setup);
                }
            });
        });

        // group of buttons with an h3 to start and showing h4-6 + p
        editor.addButton("hgroup", angular.extend({}, editor.buttons.h3,
        {
            type: "splitbutton",
            menu: [
                editor.buttons.h4,
                editor.buttons.h5,
                editor.buttons.h6,
                editor.buttons.p
            ]
        }));
    }
})();
angular.module('SxcEditTemplates', []).run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('adam/browser.html',
    "<div ng-if=vm.show><div class=\"dz-preview dropzone-adam\" ng-disabled=vm.disabled tooltip=\"{{'Edit.Fields.Hyperlink.Default.AdamUploadLabel' | translate }}\" ng-click=vm.openUpload()><div class=\"dz-image adam-browse-background-icon adam-browse-background\" xstyle=\"background-color: whitesmoke\"><i class=icon-up-circled2></i></div><div class=dz-details style=\"opacity: 1\"><div class=dz-filename><span data-dz-name=\"\">drop files</span></div></div></div><div ng-show=\"vm.allowCreateFolder() || vm.debug.on\" class=dz-preview ng-disabled=vm.disabled ng-click=vm.addFolder()><div class=\"dz-image adam-browse-background-icon adam-browse-background\"><div><i class=icon-folder-empty></i></div></div><div class=\"dz-details adam-browse-background-icon\" style=\"opacity: 1\"><i class=icon-plus style=\"font-size: 3em\"></i></div><div class=dz-details style=\"opacity: 1\"><div class=dz-size></div><div class=dz-filename style=\"position: absolute;\r" +
    "\n" +
    "    padding-bottom: 0;\r" +
    "\n" +
    "    padding-top: 50%\"><span data-dz-name=\"\">new folder</span></div></div></div><div ng-show=\"vm.showFolders || vm.debug.on\" class=dz-preview ng-disabled=vm.disabled ng-if=\"vm.folders.length > 0\" ng-click=vm.goUp()><div class=\"dz-image adam-browse-background-icon adam-browse-background\"><i class=icon-level-up></i></div><div class=dz-details style=\"opacity: 1\"><div class=dz-filename><span data-dz-name=\"\">up</span></div></div></div><div ng-show=\"vm.showFolders || vm.debug.on\" class=dz-preview ng-repeat=\"item in vm.items | filter: { IsFolder: true }  | orderBy:'Name'\" ng-click=vm.goIntoFolder(item)><div class=\"dz-image adam-browse-background-icon adam-browse-background\"><i class=icon-folder-empty></i></div><div class=\"dz-details file-type-{{item.Type}}\"><span class=pull-right ng-class=\"{'metadata-exists': item.MetadataId > 0}\" style=\"font-size: large\" ng-click=vm.editFolderMetadata(item) ng-if=vm.folderMetadataContentType stop-event=click><span tooltip={{item.MetadataId}}><i class=icon-tag style=\"font-size: larger\"></i></span></span><div class=dz-filename><span data-dz-name=\"\">{{ item.Name }}{{ vm.debug.on ? \"(lvl:\" + vm.currentFolderDepth() + \")\" : \"\"}}</span></div><div class=dz-filename><span ng-click=vm.del(item) stop-event=click ng-disabled=vm.disabled><i icon=remove></i></span></div></div></div><div class=dz-preview ng-class=\"{ 'dz-success': value.Value.toLowerCase() == 'file:' + item.Id }\" ng-repeat=\"item in (vm.items | filter: { IsFolder: false }) | filter: (vm.showImagesOnly ? {Type: 'image'} : {})  | orderBy:'Name'\" ng-click=vm.select(item) ng-disabled=\"vm.disabled || !vm.enableSelect\"><div ng-if=\"item.Type !== 'image'\" class=\"dz-image adam-browse-background-icon adam-browse-background\"><i ng-class=vm.icon(item)></i></div><div ng-if=\"item.Type === 'image'\" class=dz-image><img data-dz-thumbnail=\"\" alt=\"{{ item.Id + ':' + item.Name\r" +
    "\n" +
    "}}\" ng-src=\"{{ item.fullPath + '?w=120&h=120&mode=crop' }}\"></div><div class=\"dz-details file-type-{{item.Type}}\"><div class=\"dz-size file-icon\"><span data-dz-size=\"\"><strong>{{ item.Id }}</strong></span></div><div class=dz-filename><span data-dz-name=\"\">{{ item.Name }}</span></div><div class=dz-filename><span ng-click=vm.del(item) stop-event=click><i icon=remove></i></span> <span data-dz-name=\"\">{{ (item.Size / 1024).toFixed(0) }} kb</span></div></div><div class=dz-success-mark><svg width=54px height=54px viewbox=\"0 0 54 54\" version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xmlns:sketch=http://www.bohemiancoding.com/sketch/ns><title>Check</title><defs></defs><g id=Page-1 stroke=none stroke-width=1 fill=none fill-rule=evenodd sketch:type=MSPage><path d=\"M23.5,31.8431458 L17.5852419,25.9283877 C16.0248253,24.3679711 13.4910294,24.366835 11.9289322,25.9289322 C10.3700136,27.4878508 10.3665912,30.0234455 11.9283877,31.5852419 L20.4147581,40.0716123 C20.5133999,40.1702541 20.6159315,40.2626649 20.7218615,40.3488435 C22.2835669,41.8725651 24.794234,41.8626202 26.3461564,40.3106978 L43.3106978,23.3461564 C44.8771021,21.7797521 44.8758057,19.2483887 43.3137085,17.6862915 C41.7547899,16.1273729 39.2176035,16.1255422 37.6538436,17.6893022 L23.5,31.8431458 Z M27,53 C41.3594035,53 53,41.3594035 53,27 C53,12.6405965 41.3594035,1 27,1 C12.6405965,1 1,12.6405965 1,27 C1,41.3594035 12.6405965,53 27,53 Z\" id=Oval-2 stroke-opacity=0.198794158 stroke=#747474 fill-opacity=0.816519475 fill=#FFFFFF sketch:type=MSShapeGroup></path></g></svg></div></div></div>"
  );


  $templateCache.put('adam/dropzone-upload-preview.html',
    "<div ng-show=uploading><div class=dropzone-previews></div><span class=invisible-clickable data-note=\"just a fake, invisble area for dropzone\"></span></div>"
  );


  $templateCache.put('fields/dnn-bridge/hyperlink-default-filemanager.html',
    "<div><iframe class=sxc-dialog-filemanager-iframe style=\"width:100%; height:100%; overflow:hidden; border: 0\" scrolling=no web-forms-bridge=bridge bridge-type=filemanager bridge-sync-height=false></iframe></div><style>.sxc-dialog-filemanager .modal-dialog { width: 100%;height: 100%;margin: 0; }\r" +
    "\n" +
    "\t.sxc-dialog-filemanager .modal-content { background: none;height: 100%; }\r" +
    "\n" +
    "\t.sxc-dialog-filemanager-iframe { position: absolute;top: 0;left: 0;right: 0;bottom: 0; }</style>"
  );


  $templateCache.put('fields/dnn-bridge/hyperlink-default-pagepicker.html',
    "<div><div class=modal-header><h3 class=modal-title translate=Edit.Fields.Hyperlink.PagePicker.Title></h3></div><div class=modal-body style=\"height:370px; width:600px\"><iframe style=\"width:100%; height: 350px; border: 0\" web-forms-bridge=bridge bridge-type=pagepicker bridge-sync-height=false></iframe></div><div class=modal-footer></div></div>"
  );


  $templateCache.put('fields/hyperlink/hyperlink-default.html',
    "<div><div class=dropzone><div class=input-group dropdown><div ng-if=\"value.Value && vm.isImage()\" class=\"input-group-addon btn-default\" style=\"width: 46px; padding-top: 0px; padding-bottom: 0px; border-top-width: 0px; padding-left: 0px; padding-right: 0px; border-left-width: 0px; border-bottom-width: 0px; background-color: transparent; background-image: url('{{vm.thumbnailUrl(1)}}')\" ng-mouseover=\"vm.showPreview = true\" ng-mouseleave=\"vm.showPreview = false\"></div><input type=text class=\"form-control input-lg\" ng-model=value.Value tooltip=\"{{'Edit.Fields.Hyperlink.Default.Tooltip1' | translate }}\r" +
    "\n" +
    "{{'Edit.Fields.Hyperlink.Default.Tooltip2' | translate }}\r" +
    "\n" +
    "ADAM - sponsored with ♥ by 2sic.com\"> <span class=input-group-btn style=\"vertical-align: top\"><button type=button class=\"btn btn-primary btn-lg\" ng-disabled=to.disabled tooltip=\"{{'Edit.Fields.Hyperlink.Default.AdamUploadLabel' | translate }}\" ng-click=vm.toggleAdam()><i icon=upload></i> <i icon=apple></i></button> <button tabindex=-1 type=button class=\"btn btn-default dropdown-toggle btn-lg btn-square\" dropdown-toggle ng-disabled=to.disabled><i icon=option-horizontal></i></button></span><ul class=\"dropdown-menu pull-right\" role=menu><li role=menuitem><a class=dropzone-adam href=javascript:void(0);><i icon=apple></i> <span translate=Edit.Fields.Hyperlink.Default.MenuAdam></span></a></li><li role=menuitem ng-if=\"to.settings['merged'].ShowPagePicker\"><a ng-click=\"vm.openDialog('pagepicker')\" href=javascript:void(0)><i icon=home></i> <span translate=Edit.Fields.Hyperlink.Default.MenuPage></span></a></li><li role=menuitem ng-if=\"to.settings['merged'].ShowImageManager\"><a ng-click=\"vm.openDialog('imagemanager')\" href=javascript:void(0)><i icon=picture></i> <span translate=Edit.Fields.Hyperlink.Default.MenuImage></span></a></li><li role=menuitem ng-if=\"to.settings['merged'].ShowFileManager\"><a ng-click=\"vm.openDialog('documentmanager')\" href=javascript:void(0)><i icon=file></i> <span translate=Edit.Fields.Hyperlink.Default.MenuDocs></span></a></li></ul></div><div ng-if=vm.showPreview style=\"position: relative\"><div style=\"position: absolute; z-index: 100; background: white; top: 10px; text-align: center; left: 0; right: 0\"><img ng-src=\"{{vm.thumbnailUrl(2)}}\"></div></div><div class=\"small pull-right\"><a href=\"http://2sxc.org/help?tag=adam\" target=_blank tooltip=\"ADAM is the Automatic Digital Assets Manager - click to discover more\"><i icon=apple></i> Adam</a> is sponsored with ♥ by <a tabindex=-1 href=\"http://2sic.com/\" target=_blank>2sic.com</a></div><div ng-if=value.Value><a href={{vm.testLink}} target=_blank tabindex=-1 tooltip={{vm.testLink}}><i icon=new-window></i> <span>&nbsp;... {{vm.testLink.substr(vm.testLink.lastIndexOf(\"/\"), 100)}}</span></a></div><adam-browser content-type-name=to.header.ContentTypeName entity-guid=to.header.Guid field-name=options.key auto-load=false folder-depth=0 sub-folder=\"\" update-callback=vm.setValue register-self=vm.registerAdam ng-disabled=to.disabled></adam-browser><dropzone-upload-preview></dropzone-upload-preview></div></div>"
  );


  $templateCache.put('fields/hyperlink/hyperlink-library.html',
    "<div><div class=dropzone><adam-browser content-type-name=to.header.ContentTypeName entity-guid=to.header.Guid field-name=options.key auto-load=true sub-folder=\"\" folder-depth=to.settings.merged.FolderDepth metadata-content-type=to.settings.merged.MetadataContentType folder-metadata-content-type=to.settings.merged.FolderMetadataContentType allow-assets-in-root=to.settings.merged.allowAssetsInRoot enable-select=false update-callback=vm.setValue register-self=vm.registerAdam></adam-browser><dropzone-upload-preview></dropzone-upload-preview><div class=\"small pull-right\"><a href=\"http://2sxc.org/help?tag=adam\" target=_blank tooltip=\"ADAM is the Automatic Digital Assets Manager - click to discover more\"><i icon=apple></i> Adam</a> is sponsored with ♥ by <a tabindex=-1 href=\"http://2sic.com/\" target=_blank>2sic.com</a></div></div></div>"
  );


  $templateCache.put('fields/string/string-wysiwyg-adv.html',
    "<div>this would be an advanced, configurable WYSIWYG. It does not exist yet :).</div>"
  );


  $templateCache.put('fields/string/string-wysiwyg-dnn.html',
    "<iframe style=\"width:100%; border: 0\" web-forms-bridge=vm.bridge bridge-type=wysiwyg bridge-sync-height=true></iframe>"
  );


  $templateCache.put('fields/string/string-wysiwyg-tinymce.html',
    "<div><div class=dropzone><div ui-tinymce=tinymceOptions ng-model=value.Value class=field-string-wysiwyg-mce-box></div><adam-browser content-type-name=to.header.ContentTypeName entity-guid=to.header.Guid field-name=options.key auto-load=false folder-depth=0 sub-folder=\"\" update-callback=vm.setValue register-self=vm.registerAdam show-images-only=vm.adamModeImage ng-disabled=to.disabled></adam-browser><dropzone-upload-preview></dropzone-upload-preview><div class=\"small pull-right\"><a href=\"http://2sxc.org/help?tag=adam\" target=_blank tooltip=\"ADAM is the Automatic Digital Assets Manager - click to discover more\">supports <i icon=apple></i> Adam - just drop files</a> with ♥ by <a tabindex=-1 href=\"http://2sic.com/\" target=_blank>2sic.com</a></div></div></div>"
  );

}]);
