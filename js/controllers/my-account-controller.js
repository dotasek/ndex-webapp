ndexApp.controller('myAccountController',
    ['ndexService', 'ndexUtility', 'sharedProperties', '$scope', '$rootScope',
        '$location', '$routeParams', '$route', '$modal', 'uiMisc', 'ndexNavigation', 'uiGridConstants',
        function (ndexService, ndexUtility, sharedProperties, $scope, $rootScope,
                  $location, $routeParams, $route, $modal, uiMisc, ndexNavigation, uiGridConstants)
        {
            //              Process the URL to get application state
            //-----------------------------------------------------------------------------------
            
          //  var identifier = ndexUtility.getUserCredentials()["externalId"];
            var identifier = sharedProperties.getCurrentUserId(); //$routeParams.identifier;


            //              CONTROLLER INTIALIZATIONS
            //------------------------------------------------------------------------------------

            $scope.myAccountController = {};
            var myAccountController = $scope.myAccountController;
            myAccountController.isLoggedInUser = (window.currentNdexUser != null);
            myAccountController.identifier = identifier;
            myAccountController.loggedInIdentifier = sharedProperties.getCurrentUserId();
            myAccountController.displayedUser = {};

            //groups
            myAccountController.groupSearchAdmin = false; // this state needs to be saved to avoid browser refresh
            myAccountController.groupSearchMember = false;
            myAccountController.groupSearchResults = [];
            myAccountController.originalGroupSearchResults = [];

            //networks
            myAccountController.networkQuery = {};
            myAccountController.networkSearchResults = [];
            myAccountController.skip = 0;
            myAccountController.skipSize = 10000;
            myAccountController.networkTableRowsSelected = 0;
            //myAccountController.collectionTableRowsSelected = 0;

            myAccountController.pendingRequests = [];
            myAccountController.sentRequests = [];

            //tasks
            myAccountController.tasks = [];

            // list of network IDs of all networks for which the current user has ADMIN access and therefore can delete.
            // These networks are owned by both the current user and other users.
            myAccountController.networksWithAdminAccess = [];

            // list of network IDs of all networks for which the current user has WRITE access and therefore can update.
            // These networks are owned by both the current user and other users.
            myAccountController.networksWithWriteAccess = [];

            // this map of Cytoscape collection networks; networkUUID is a key and <numberOfSubNetworks> is a value;
            // we only put networks with number of subnetwroks greater than 1
            myAccountController.networksWithMultipleSubNetworks = {};
            
            // this function gets called when user navigates away from the current page.
            // (can also use "$locationChangeStart" instead of "$destroy"
            $scope.$on("$destroy", function(){
                // hide the Search menu item in Nav Bar
                $scope.$parent.showSearchMenu = false;
                uiMisc.showSearchMenuItem();
            });

            $scope.diskSpaceInfo = {};

            uiMisc.hideSearchMenuItem();
            $scope.$parent.showSearchMenu = true;

            $scope.enableEditPropertiesBulkButton = false;
            $scope.enableShareBulkButton = false;
            $scope.enableEditAndExportBulkButtons = false;


            myAccountController.editProfilesLabel    = "Edit Profile";
            myAccountController.exportNetworksLabel  = "Export Network";
            myAccountController.addToNetworkSetLabel = "Add To Set";
            myAccountController.deleteNetworksLabel  = "Delete Network";

            myAccountController.networkSets = [];

            //table
            $scope.networkGridOptions =
            {
                enableSorting: true,
                enableFiltering: true,
                showGridFooter: true,
                // the default value value of columnVirtualizationThreshold is 10; we need to set it to 20 because
                // otherwise it will not show all columns if we display more than 10 columns in our table
                columnVirtualizationThreshold: 20,
                enableColumnMenus: false,
                enableRowHeaderSelection: true,

                onRegisterApi: function( gridApi )
                {
                    $scope.networkGridApi = gridApi;

                    gridApi.core.on.rowsRendered($scope, function() {
                        // we need to call core.handleWindowResize() to fix the table layout in case it is distorted
                        $scope.networkGridApi.core.handleWindowResize();
                    });

                    gridApi.selection.on.rowSelectionChanged($scope,function(row){

                        if ((row.entity.Status == 'Set') && (row.isSelected)) {
                            row.isSelected = false;

                            var selectedCount = $scope.networkGridApi.grid.selection.selectedCount;
                            if (selectedCount > 0) {
                                $scope.networkGridApi.grid.selection.selectedCount = selectedCount - 1;

                                var title = "Cannot Select a Set";
                                var message =
                                    "Cannot select a Set in this release. This feature will be added in future.";

                                ndexNavigation.genericInfoModal(title, message);
                            };

                            return;
                        };

                        var selectedRows = gridApi.selection.getSelectedRows();
                        myAccountController.networkTableRowsSelected = selectedRows.length;

                        changeNetworkBulkActionsButtonsLabels();

                        enableOrDisableEditAndExportBulkButtons();
                        enableOrDisableEditPropertiesBulkButton();
                        enableOrDisableManageAccessBulkButton();
                    });

                    gridApi.selection.on.rowSelectionChangedBatch($scope,function(rows){

                        _.forEach(rows, function(row) {
                            if ((row.entity.Status == 'Set') && (row.isSelected)) {
                                // unselect a Set: make row.isSelected false and decrement the number of selected items
                                row.isSelected = false;

                                var selectedCount = $scope.networkGridApi.grid.selection.selectedCount;
                                if (selectedCount > 0) {
                                    $scope.networkGridApi.grid.selection.selectedCount = selectedCount - 1;
                                };
                            };
                        });

                        var selectedRows = gridApi.selection.getSelectedRows();
                        myAccountController.networkTableRowsSelected = selectedRows.length;

                        changeNetworkBulkActionsButtonsLabels();

                        enableOrDisableEditAndExportBulkButtons();
                        enableOrDisableEditPropertiesBulkButton();
                        enableOrDisableManageAccessBulkButton();
                    });
                }
            };

            $scope.showNetworkTable = function() {
                return (myAccountController.networkSearchResults.length > 0) ||
                       (myAccountController.networkSets.length > 0);
            };

            var changeNetworkBulkActionsButtonsLabels = function() {
                if (myAccountController.networkTableRowsSelected > 1) {
                    myAccountController.editProfilesLabel   = "Edit Profiles";
                    myAccountController.exportNetworksLabel = "Export Networks";
                    myAccountController.deleteNetworksLabel = "Delete Networks";
                } else {
                    myAccountController.editProfilesLabel   = "Edit Profile";
                    myAccountController.exportNetworksLabel = "Export Network";
                    myAccountController.deleteNetworksLabel = "Delete Network";
                };
            };

            var populateNetworkTable = function()
            {
                var columnDefs = [
                    { field: '  ', enableFiltering: false, maxWidth: 42, cellTemplate: 'pages/gridTemplates/networkStatusOnMyAccountPage.html'},
                    { field: 'Network Name', enableFiltering: true, cellTemplate: 'pages/gridTemplates/networkName.html' },
                    { field: ' ', enableFiltering: false, width:40, cellTemplate: 'pages/gridTemplates/downloadNetwork.html' },

                    { field: 'Format', enableFiltering: true, maxWidth:63,
                        sort: {
                            direction: uiGridConstants.DESC,
                            priority: 0,
                        },

                        sortingAlgorithm: function(a, b, rowA, rowB, direction) {
                            if (a === b) {
                                return 0;
                            };
                            if (a === 'Set') {
                                return 1;
                            };
                            if (b === 'Set') {
                                return -1;
                            };
                            return 0;
                        }
                    },

                    { field: 'Ref.', enableFiltering: false, maxWidth: 45, cellTemplate: 'pages/gridTemplates/reference.html' },
                    { field: 'Disease', enableFiltering: true, width: 68, cellTemplate: 'pages/gridTemplates/disease.html'},
                    { field: 'Tissue',  enableFiltering: true, maxWidth: 65, cellTemplate: 'pages/gridTemplates/tissue.html'},
                    //{ field: 'Nodes', enableFiltering: false, maxWidth:70 },
                    { field: 'Edges', enableFiltering: false, maxWidth:70 },
                    { field: 'Visibility', enableFiltering: true, maxWidth:70, cellClass: 'grid-align-cell' },
                    { field: 'Owner', enableFiltering: true, width:80, cellTemplate: 'pages/gridTemplates/ownedBy.html' },
                    { field: 'Last Modified', enableFiltering: false, maxWidth:120,
                        cellFilter: "date:'short'",  sort: {direction: 'desc', priority: 5}
                    },

                    /*
                    { field: 'Last Modified', enableFiltering: false, width:170,
                        cellFilter: 'date:\'MMM dd, yyyy hh:mm:ssa\'',  sort: {direction: 'desc', priority: 0},
                        cellClass: 'grid-align-cell' },
                    */

                    { field: 'Show', enableFiltering: false, maxWidth: 60, cellTemplate: 'pages/gridTemplates/showCase.html' },

                    { field: 'description', enableFiltering: false,  visible: false},
                    { field: 'externalId',  enableFiltering: false,  visible: false},
                    { field: 'ownerUUID',   enableFiltering: false,  visible: false},
                    { field: 'name',        enableFiltering: false,  visible: false}
                ];
                $scope.networkGridApi.grid.options.columnDefs = columnDefs;
                refreshNetworkTable();
            };

            /*
            $scope.signClicked = function(networkSetExpanded, row) {
                //alert('sign clicked; row.$$height=' + row.$$height);
                //row.$$height = (networkSetExpanded) ? 30 : row.$$height + row.$$height * row.entity.networks.length;


                //$scope.collectionGridApi.grid.options.rowHeight = 'autopx'; //(networkSetExpanded) ? 30 : row.$$height * row.entity.networks.length;
                //$scope.collectionGridApi.grid.rows[1].$$height = (networkSetExpanded) ? 30 : row.$$height * row.entity.networks.length;
                //$scope.collectionGridApi.grid.rowHashMap.grid.rows[1].$$height = (networkSetExpanded) ? 30 : row.$$height * row.entity.networks.length;

                return;
            };
            */

            $scope.getExportedNetworkDownloadLink = function(taskId) {
                return ndexService.getNdexServerUri() + "/task/" + taskId + "/file?download=true";
            };

            $scope.getCredentialsForExportedNetworkDownload = function() {
                document.getElementById("exportedNetworkDownoadLinkId").username = ndexUtility.getUserCredentials()['userName'];
                document.getElementById("exportedNetworkDownoadLinkId").password = ndexUtility.getUserCredentials()['token'];
            };


            $scope.showSetInfo = function(setId) {
                var networkSet = _.find(myAccountController.networkSets, {externalId:setId});

                // make a copy of network summary object since we are going to modify it
                var set = JSON.parse(JSON.stringify(networkSet));

                uiMisc.showSetInfo(set);
            };

            /*
             * This function removes most HTML tags and replaces them with markdown symbols so that this
             * field could be displayed in the title element of networkName.html template in the pop-up window
             * when mouse cursor hovers over it.
             */
            $scope.stripHTML = function(html) {

                if (!html) {
                    return "";
                }

                // convert HTML to markdown; toMarkdown is defined in to-markdown.min.js
                var markDown = toMarkdown(html);

                // after using toMarkdown() at previous statement, markDown var can still contain
                // some HTML Code (i.e.,<span class=...></span>). In order to remove it, we use jQuery text() function.
                // We need to add <html> and </html> in the beginning and of markDown variable; otherwise, markDown
                // will not be recognized byu text() as a valid HTML and exception will be thrown.

                // Note that we need to use toMarkdown() followed by jQuery text(); if just jQuery text() is used, then
                // all new lines and </p> , </h1>...</h6> tags are removed; and all lines get "glued" together
                var markDownFinal  = $("<html>"+markDown+"</html>").text();

                return markDownFinal;
            };
            
            var enableOrDisableEditAndExportBulkButtons = function() {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();
                $scope.enableEditAndExportBulkButtons = true;

                var statesForWhichToDisable = ["failed", "processing", "collection"];

                _.forEach (selectedNetworksRows, function(row) {

                    var status = row.Status;

                    var disableEditAndExportBulkButtons =
                        (status && statesForWhichToDisable.indexOf(status.toLowerCase()) > -1);

                    if (disableEditAndExportBulkButtons) {
                        $scope.enableEditAndExportBulkButtons = false;
                        return;
                    };
                });
            };


            var enableOrDisableEditPropertiesBulkButton = function() {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();
                $scope.enableEditPropertiesBulkButton = false;

                for (var i = 0; i < selectedNetworksRows.length; i++) {

                    var ownerUUID = selectedNetworksRows[i].ownerUUID;
                    var status = selectedNetworksRows[i].Status;

                    var network_in_invalid_state =
                        (status && ["failed", "processing"].indexOf(status.toLowerCase()) > -1);

                    if (network_in_invalid_state) {
                        return;
                    }

                    var networkUUUID = selectedNetworksRows[i].externalId;
                    if (networkUUUID in myAccountController.networksWithMultipleSubNetworks) {
                        return;
                    };

                    if (ownerUUID == myAccountController.loggedInIdentifier) {
                        // we are owner of the network, it means we can change it; get next selected network
                        continue;
                    };

                    // here, ownerUUID != myAccountController.loggedInIdentifier
                    /*
                    if ((myAccountController.networksWithAdminAccess.indexOf(networkUUUID) == -1) &&
                        (myAccountController.networksWithWriteAccess.indexOf(networkUUUID) == -1) ) {
                        return;
                    };
                    */
                };

                $scope.enableEditPropertiesBulkButton = true;
            };

            var enableOrDisableManageAccessBulkButton = function() {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();
                $scope.enableShareBulkButton = false;

                for (var i = 0; i < selectedNetworksRows.length; i++) {

                    var ownerUUID = selectedNetworksRows[i].ownerUUID;
                    var status = selectedNetworksRows[i].Status;

                    var network_in_invalid_state =
                        (status && ["failed", "processing"].indexOf(status.toLowerCase()) > -1);

                    if (ownerUUID != myAccountController.loggedInIdentifier || network_in_invalid_state) {
                        return;
                    };
                };

                $scope.enableShareBulkButton = true;
            };
            
            var refreshNetworkTable = function()
            {
                $scope.networkGridOptions.data = [];

                _.forEach(myAccountController.networkSets, function(networkSet) {
                    myAccountController.addNetworkSetToTable(networkSet);
                });

                for(var i = 0; i < myAccountController.networkSearchResults.length; i++ )
                {
                    var network = myAccountController.networkSearchResults[i];

                    var subNetworkInfo  = uiMisc.getSubNetworkInfo(network);
                    var noOfSubNetworks = subNetworkInfo['numberOfSubNetworks'];
                    var subNetworkId    = subNetworkInfo['id'];

                    var networkStatus = "success";
                    if (network.errorMessage) {
                        networkStatus = "failed";
                    } else if (!network.isValid) {
                        networkStatus = "processing";
                    };
                    
                    if ((networkStatus == "success") && network.warnings && network.warnings.length > 0) {
                        networkStatus = "warning";
                    };

                    var networkName = (!network['name']) ? "No name; UUID : " + network.externalId : network['name'];
                    if (networkStatus == "failed") {
                        networkName = "Invalid Network. UUID: " + network.externalId;
                    } else if (noOfSubNetworks > 1) {
                        networkStatus = "collection";
                    };

                    var description = $scope.stripHTML(network['description']);
                    var externalId = network['externalId'];
                    //var nodes = network['nodeCount'];
                    var edges = network['edgeCount'];
                    var owner = network['owner'];
                    var visibility = network['visibility'];
                    var modified = new Date( network['modificationTime'] );
                    var showcase = network['isShowcase'];

                    var format    = (subNetworkId) ? uiMisc.getNetworkFormat(subNetworkId, network) :
                        uiMisc.getNetworkFormatForMultipleSubNetworks(network);
                    var download  = "Download " + networkName;
                    var reference = uiMisc.getNetworkReferenceObj(subNetworkId, network);
                    var disease   = uiMisc.getDisease(network);
                    var tissue    = uiMisc.getTissue(network);

                    var errorMessage = network.errorMessage;

                    var networks = 0;
                    var isReadOnly = network['isReadOnly'] ? network['isReadOnly'] : false;

                    /*
                    if (networkStatus == "collection") {
                        format = "Collection";
                    };
                    */

                    var row =   {
                        "Status"        :   networkStatus,
                        "Network Name"  :   networkName,
                        " "             :   download,
                        "Format"        :   format,
                        "Reference"     :   reference,
                        "Disease"       :   disease,
                        "Tissue"        :   tissue,
                        //"Nodes"         :   nodes,
                        "Edges"         :   edges,
                        "Visibility"    :   visibility,
                        "Owner"         :   owner ,
                        "Last Modified" :   modified,
                        "Show"          :   showcase,
                        "description"   :   description,
                        "externalId"    :   externalId,
                        "ownerUUID"     :   network['ownerUUID'],
                        "name"          :   networkName,
                        "errorMessage"  :   errorMessage,
                        "subnetworks"   :   noOfSubNetworks,
                        "networks"      :   networks,
                        "isReadOnly"    :   isReadOnly
                    };
                    $scope.networkGridOptions.data.push(row);
                };
            };

            myAccountController.tasksNotificationsTabDisabled = function() {

                if ( (myAccountController.tasks.length > 0) ||
                     (myAccountController.pendingRequests.length > 0) ||
                     (myAccountController.sentRequests.length > 0)) {
                    return false;
                }

                return true;
            };

            myAccountController.getTaskFileExt = function(task)
            {
                if( !task.format )
                    return "";
                if( task.format.toUpperCase() == 'BIOPAX' )
                    return 'owl';
                else {
                    var networkFileExtension = task.format.toLowerCase() + ".gz";
                    return networkFileExtension;
                }
            };

            myAccountController.getNetworkDownloadName = function(task)
            {
                if (typeof task.attributes === 'undefined') {
                    return;
                }

                var name = (typeof task.attributes.downloadFileName === 'undefined') ?
                    task.externalId : task.attributes.downloadFileName.replace(/ /g, "_");

                var extension = (typeof task.attributes.downloadFileExtension === 'undefined') ?
                    "txt" : myAccountController.getTaskFileExt(task);

                var networkNameForDownload = name + "." + extension;

                return networkNameForDownload;
            };

            myAccountController.getNetworkName = function(task)
            {
                if (typeof task.attributes === 'undefined' ||
                    typeof task.attributes.downloadFileName === 'undefined') {
                    return task.externalId;
                }

                return task.attributes.downloadFileName;
            };

            // recursive function that deletes all tasks from the server
            myAccountController.deleteAllTasks = function()
            {
                // delete all tasks that are visible to the user
                for (var i = 0; i < myAccountController.tasks.length; i++) {
                    var task = myAccountController.tasks[i];
                    myAccountController.deleteTask(task.externalId);
                }

                // there may be more tasks on the server; try to get them
                ndexService.getUserTasksV2(
                     "ALL",
                     0,
                     100,
                     // Success callback function
                     function (tasks)
                     {
                         if (tasks.length == 0) {
                             // recursive base case: no task was retrieved from the server
                             return;
                         }

                         // recursive general case: more tasks were retrieved -- call itself
                         // (myAccountController.deleteAllTasks) to delete them
                         myAccountController.tasks = tasks;
                         myAccountController.deleteAllTasks();
                     },
                     // Error
                     function (response)
                     {
                         return;
                     }
                )
            };

            myAccountController.checkAndDeleteSelectedNetworks = function() {
                var checkWritePrivilege = false;
                var networksDeleteable =
                    myAccountController.checkIfSelectedNetworksCanBeDeletedOrChanged(checkWritePrivilege);

                if (networksDeleteable) {
                    myAccountController.confirmDeleteSelectedNetworks(
                        function() {
                            // all selected networks have been deleted ...
                            // update available storage indication

                            ndexService.getUserByUUIDV2(myAccountController.identifier)
                                .success(
                                    function (user) {
                                        $scope.diskSpaceInfo = uiMisc.showAvailableDiskSpace(user);
                                    });
                        },
                        function() {
                            ; // canceled, nothing to do here
                        }
                    );
                } else {
                    var title = "Cannot Delete Selected Networks";
                    var message =
                        "Some selected networks could not be deleted because they are either marked READ-ONLY" +
                        " or you do not have ADMIN privileges. Please uncheck the READ-ONLY box in each network " +
                        " page, make sure you have ADMIN access to all selected networks, and try again.";

                    myAccountController.genericInfoModal(title, message);
                }
                return;
            };

            myAccountController.genericInfoModal = function(title, message)
            {
                var   modalInstance = $modal.open({
                    templateUrl: 'pages/generic-info-modal.html',
                    scope: $scope,

                    controller: function($scope, $modalInstance) {

                        $scope.title = title;
                        $scope.message = message;

                        $scope.close = function() {
                            $modalInstance.dismiss();
                        };
                    }
                });
            };

            myAccountController.confirmDeleteSelectedNetworks = function(deletedHandler, canceledHandler)
            {
                var   modalInstance = $modal.open({
                    templateUrl: 'confirmation-modal.html',
                    scope: $scope,

                    controller: function($scope, $modalInstance) {

                        $scope.title = 'Delete Selected Networks';
                        $scope.message =
                            'The selected networks will be permanently deleted from NDEx. Are you sure you want to proceed?';

                        $scope.cancel = function() {
                            $modalInstance.dismiss();
                            $scope.isProcessing = false;
                            canceledHandler();
                        };

                        $scope.confirm = function() {
                            $scope.isProcessing = true;
                            myAccountController.deleteSelectedNetworks($scope, $modalInstance, deletedHandler);
                            //$modalInstance.dismiss();
                            $scope.isProcessing = false;
                        };
                    }
                });
            };

            /*
            myAccountController.confirmDeleteSelectedSets = function()
            {
                var   modalInstance = $modal.open({
                    templateUrl: 'confirmation-modal.html',
                    scope: $scope,

                    controller: function($scope, $modalInstance) {

                        if (myAccountController.collectionTableRowsSelected > 1) {
                            $scope.title = 'Delete Selected Sets';
                            $scope.message =
                                'The selected ' + myAccountController.collectionTableRowsSelected +
                                ' sets will be deleted from NDEx. Are you sure you want to proceed?';
                        } else {
                            $scope.title = 'Delete Selected Set';
                            $scope.message =
                                'The selected set will be deleted from NDEx. Are you sure you want to proceed?';
                        };

                        $scope.cancel = function() {
                            $modalInstance.dismiss();
                            $scope.isProcessing = false;
                        };

                        $scope.confirm = function() {
                            $scope.isProcessing = true;
                            myAccountController.deleteSelectedSets();
                            $modalInstance.dismiss();
                            $scope.isProcessing = false;
                        };
                    }
                });
            };
            */

            myAccountController.manageBulkAccess = function(path, currentUserId)
            {
                var selectedIDs = myAccountController.getIDsOfSelectedNetworks();
                sharedProperties.setSelectedNetworkIDs(selectedIDs);
                sharedProperties.setCurrentUserId(currentUserId);
                $location.path(path);
            };

            myAccountController.allTasksCompleted = function() {
                var task;

                for (var i = 0; i < myAccountController.tasks.length; i++) {
                    task = myAccountController.tasks[i];
                    if (task.status.toUpperCase() === 'PROCESSING') {
                        return false;
                    }
                }
                return true;
            };

            myAccountController.getIDsOfSelectedNetworks = function ()
            {
                var selectedIds = [];
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                _.forEach(selectedNetworksRows, function(row) {
                    if (row.Format.toLowerCase() != "set") {
                        selectedIds.push(row['externalId']);
                    };
                });

                return selectedIds;
            };

            myAccountController.getVisibilityAndShowcaseOfSelectedNetworks = function ()
            {
                var visibilityAndShowcase = {};
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                _.forEach(selectedNetworksRows, function(row) {
                    if (row.Format.toLowerCase() != "set") {

                        visibilityAndShowcase[row['externalId']] =
                            {
                                'visibility':  row['Visibility'] ? row['Visibility'] : 'PRIVATE',
                                'showCase':    row['Show'] ? row['Show'] : false,
                                'networkName': row['name']
                            };
                    };
                });

                return visibilityAndShowcase;
            };

            myAccountController.getReadOnlyOfSelectedNetworks = function ()
            {
                var readOnly = {};
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                _.forEach(selectedNetworksRows, function(row) {
                    if (row.Format.toLowerCase() != "set") {

                        readOnly[row['externalId']] =
                            {
                                'isReadOnly':  row['isReadOnly'] ? row['isReadOnly'] : false,
                                'networkName': row['name']
                            };
                    };
                });

                return readOnly;
            };

            myAccountController.updateVisibilityOfNetworks = function (networkUUIDs, networkVisibility)
            {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                // change 'Visibility' in the Network Table
                _.forEach(selectedNetworksRows, function(row) {
                    if (row['externalId'] in networkUUIDs) {
                        row['Visibility'] = networkVisibility;
                    };
                });

                // change 'visibility' in the Network Search list
                _.forEach(myAccountController.networkSearchResults, function(row) {
                    if (row['externalId'] in networkUUIDs) {
                        row['visibility'] = networkVisibility;
                    };
                });
            };

            myAccountController.updateShowcaseOfNetworks = function (networkUUIDs, showCase)
            {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                _.forEach(selectedNetworksRows, function(row) {
                    if (row['externalId'] in networkUUIDs) {
                        row['Show'] = showCase;
                    };
                });

                _.forEach(myAccountController.networkSearchResults, function(row) {
                    if (row['externalId'] in networkUUIDs) {
                        row['isShowcase'] = showCase;
                    };
                }
                );
            };
            myAccountController.updateReadOnlyOfNetworks = function (networkUUIDs, readOnly)
            {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                _.forEach(selectedNetworksRows, function(row) {
                    if (row['externalId'] in networkUUIDs) {
                        row['isReadOnly'] = readOnly;
                    };
                });

                _.forEach(myAccountController.networkSearchResults, function(row) {
                    if (row['externalId'] in networkUUIDs) {
                        row['isReadOnly'] = readOnly;
                    };
                });
            };


            myAccountController.updateDescriptionOfNetworks = function (networkUUIDs, newDescription)
            {
                var description = (newDescription) ? $scope.stripHTML(newDescription) : newDescription;

                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                // change Network Summaries in Network table
                _.forEach(selectedNetworksRows, function(row) {
                    var networkId = row.externalId;

                    if (networkId in networkUUIDs) {
                        row['description'] = description;
                    };
                });


                // change Network Summary in Network Search list
                _.forEach(myAccountController.networkSearchResults, function (row) {

                    var networkId = row.externalId;

                    if (networkId in networkUUIDs) {
                        row['description'] = description;
                    };

                });

                return;
            };

            myAccountController.updateReferenceOfNetworks = function (networkUUIDs, newReference)
            {
                //var reference = (newReference) ? $scope.stripHTML(newDescription) : newDescription;

                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                var mySearch = myAccountController.networkSearchResults;

                // change Network References in Network table
                _.forEach(selectedNetworksRows, function(row) {
                    var networkId = row.externalId;

                    if (networkId in networkUUIDs) {
                        row['Reference'] = newReference;
                    };
                });


                // change Network Summary in Network Search list
                /*
                _.forEach(myAccountController.networkSearchResults, function (row) {

                    var networkId = row.externalId;

                    if (networkId in networkUUIDs) {
                        row['reference'] = description;
                    };

                });
                */

                return;
            };

            /*
             * This function is used by Bulk Network Delete and Bulk Network Edit Properties operations.
             * It goes through the list of selected networks and checks if the networks
             * can be deleted (or modified in case checkWriteAccess is set to true).
             * It makes sure that in the list of selected networks
             *
             * 1) there are no read-only networks, and
             * 2) that the current user can delete the selected networks (i.e., has Admin access to all of them).
             *
             * If either of the above conditions is false, than the list of networks cannot be deleted.
             *
             * If the function was called with (checkWriteAccess=true) then it also checks if user has
             * WRITE access to the networks.
             *
             * The function returns true if all networks can be deleted or modified, and false otherwise (all or none).
             */
            myAccountController.checkIfSelectedNetworksCanBeDeletedOrChanged = function(checkWriteAccess) {

                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                // iterate through the list of selected networks
                for (var i = 0; i < selectedNetworksRows.length; i++) {
                    var externalId1 = selectedNetworksRows[i].externalId;

                    // check if the selected network is read-only and can be deleted by the current account
                    for (var j = 0; j < myAccountController.networkSearchResults.length; j++) {

                        var externalId2 = myAccountController.networkSearchResults[j].externalId;

                        // find the current network info in the list of networks this user has access to
                        if (externalId1 !== externalId2) {
                            continue;
                        }

                        // check if network is read-only
                        if (myAccountController.networkSearchResults[j].isReadOnly) {
                            // it is read-only; cannot delete or modify
                            return false;
                        }

                        // check if you have admin privilege for this network
                        if (myAccountController.networksWithAdminAccess.indexOf(externalId1) == -1) {
                            // the current user is not admin for this network, therefore, (s)he cannot delete it

                            // see if user has WRITE access in case this function was called to check whether
                            // network can be modified
                            if (checkWriteAccess) {

                                if (myAccountController.networksWithWriteAccess.indexOf(externalId1) == -1) {
                                    // no ADMIN or WRITE privilege for this network.  The current user cannot modify it.
                                    return false;
                                }
                            } else {
                                // we don't check if user has WRITE privilege here (since checkWriteAccess is false)
                                // and user has no ADMIN access, which means the network cannot be deleted by the current user
                                return false;
                            }
                        }
                    }
                }

                return true;
            };
            
            /*
             * This function returns true if the current user has ADMIN access to all selected networks,
             * and false otherwise.
             */
            myAccountController.checkAdminPrivilegeOnSelectedNetworks = function() {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();
                var retValue = true;

                // iterate through the list of selected networks and check if user has ADMIN access to all of them
                _.forEach(selectedNetworksRows, function(row) {
                    var networkUUID = row.externalId;

                    // check if you have admin privilege for this network
                    if (myAccountController.networksWithAdminAccess.indexOf(networkUUID) == -1) {
                        retValue = false;
                        return;
                    };
                });

                return retValue;
            };


            var removeDeletedNetworksFromSearchAndNetworksTable = function($scope, networkIds) {
                var externalId = null;

                for (var i = $scope.networkGridOptions.data.length - 1; i >= 0; i--)
                {
                    externalId = $scope.networkGridOptions.data[i].externalId;
                    if (externalId in networkIds) {
                        $scope.networkGridOptions.data.splice(i, 1);
                    };
                };

                $scope.networkGridApi.selection.clearSelectedRows();
                myAccountController.networkTableRowsSelected = 0;

                // remove the networks from the search result
                for (var i = myAccountController.networkSearchResults.length - 1; i >= 0; i--)
                {
                    externalId = myAccountController.networkSearchResults[i].externalId;
                    if (externalId in networkIds) {
                        myAccountController.networkSearchResults.splice(i, 1);
                    };
                };
            };

            myAccountController.deleteSelectedNetworks = function ($scope, $modalInstance, deletedHandler)
            {
                var selectedIds = [];
                var successfullyDeletedNetworkIDs = {};

                var deletedNetworksCounter = 0;
                var selectedNetworkCount = $scope.networkGridApi.selection.getSelectedRows().length;

                $scope.progress  = "Deleted: " + deletedNetworksCounter + " of " + selectedNetworkCount + " selected networks";

                _.forEach($scope.networkGridApi.selection.getSelectedRows(), function(row) {

                    if (row.Status && row.Status.toLowerCase() == 'set') {
                        // this should never happen since we do not allow selecting sets,
                        // but just in case ...
                        deletedNetworksCounter = deletedNetworksCounter + 1;
                        return;
                    };

                    var networkId   = row.externalId;
                    var networkName = row.name;

                    ndexService.deleteNetworkV2(networkId,
                        function (data)
                        {
                            deletedNetworksCounter = deletedNetworksCounter + 1;
                            successfullyDeletedNetworkIDs[networkId] = "";

                            $scope.progress  = "Deleted: " + deletedNetworksCounter + " of " + selectedNetworkCount + " selected networks";
                            $scope.progress2 = "Deleted: " + networkName;

                            if (deletedNetworksCounter == selectedNetworkCount) {

                                removeDeletedNetworksFromSearchAndNetworksTable($scope, successfullyDeletedNetworkIDs);

                                setTimeout(function() {
                                    delete $scope.progress;
                                    delete $scope.progress2;
                                    delete $scope.errors;
                                    $scope.isProcessing = false;
                                    $modalInstance.dismiss();
                                }, 1000);

                                deletedHandler();
                            };
                        },
                        function (error)
                        {
                            deletedNetworksCounter = deletedNetworksCounter + 1;

                            $scope.error = "Unable to delete network " + networkName;

                            if (deletedNetworksCounter == selectedNetworkCount) {

                                removeDeletedNetworksFromSearchAndNetworksTable($scope, successfullyDeletedNetworkIDs);

                                setTimeout(function() {
                                    delete $scope.progress;
                                    delete $scope.progress2;
                                    delete $scope.errors;
                                    $scope.isProcessing = false;
                                    $modalInstance.dismiss();
                                }, 1000);

                                deletedHandler();
                            };
                        });
                });
            };

            /*
            myAccountController.deleteSelectedSets = function ()
            {
                var selectedCollectionsRows = $scope.collectionGridApi.selection.getSelectedRows();
                var selectedIds = [];

                _.forEach(selectedCollectionsRows, function(row) {

                    var collectionUUID = row.externalId;

                    selectedIds.push(collectionUUID);

                    ndexService.deleteNetworkSetV2(collectionUUID,

                        function (data)
                        {
                            //console.log("success");
                        },
                        function (error)
                        {
                            console.log("unable to delete network set");
                        });
                });

                // after we deleted all selected collections, the footer of the table may
                // still show that some networks are selected (must be a bug), so
                // we manually set the selected count to 0 (see defect NDEX-582)
                $scope.collectionGridApi.grid.selection.selectedCount = 0;

                for (var i = myAccountController.networkSets.length - 1; i >= 0; i--) {
                    var collectionUUID = myAccountController.networkSets[i].externalId;
                    if (selectedIds.indexOf(collectionUUID) != -1) {
                        myAccountController.networkSets.splice(i, 1);
                    };
                };
                refreshCollectionsTable();
                myAccountController.collectionTableRowsSelected = 0;
            };
            */


            //              scope functions

            // change to use directive. setting of current network should occur controller initialization
            myAccountController.setAndDisplayCurrentNetwork = function (identifier)
            {
                $location.path("/network/" + identifier);
            };

            var checkGroupSearchResultObject = function(groupObj) {
                var found = false;

                for (var i = 0; i < myAccountController.originalGroupSearchResults.length; i++ ) {
                    if (groupObj.externalId == myAccountController.originalGroupSearchResults[i].externalId) {
                        found = true;
                        break;
                    }
                }

                return found;
            };

            myAccountController.searchGroupsFromUserInput = function() {
                var searchString = myAccountController.groupSearchString;

                ndexService.searchGroupsV2(searchString, 0, 1000000,
                    function(groupObjectsFound) {

                        myAccountController.groupSearchResults = [];

                        if (groupObjectsFound && groupObjectsFound.resultList && groupObjectsFound.resultList.length > 0) {

                            for (var i = 0; i < groupObjectsFound.resultList.length; i++) {
                                var groupObj = groupObjectsFound.resultList[i];

                                if (checkGroupSearchResultObject(groupObj)) {
                                    myAccountController.groupSearchResults.push(groupObj);
                                };
                            };
                        };
                    },
                    function(error) {
                        console.log("unable to search groups");
                    });
            };

            myAccountController.getUserGroupMemberships = function (member)
            {
                /*
                 * To get list of Group objects we need to:
                 *
                 * 1) Use Get User’s Group Memberships API at
                 *    /user/{userid}/membership?type={membershiptype}&start={startPage}&size={pageSize}
                 *    to get the list of GROUPADMIN and MEMBER memberships
                 *
                 * 2) Get a list of Group UUIDs from step 1
                 *
                 * 3) Use this list of Group UUIDs to get Groups through
                 *    /group/groups API.
                 */
                ndexService.getUserGroupMembershipsV2(myAccountController.identifier, member, 0, 1000000,

                        function (userMembershipsMap) {

                            var groupsUUIDs = Object.keys(userMembershipsMap);

                            ndexService.getGroupsByUUIDsV2(groupsUUIDs)
                                .success(
                                    function (groupList) {
                                        myAccountController.groupSearchResults = groupList;
                                        myAccountController.originalGroupSearchResults = groupList;
                                    })
                                .error(
                                    function(error) {
                                        console.log("unable to get groups by UUIDs");
                                    }
                                )
                        },
                        function (error, status, headers, config, statusText) {
                            console.log("unable to get user group memberships");
                        });
            };

            myAccountController.getAllNetworkSetsOwnedByUser = function (successHandler, errorHandler)
            {
                ndexService.getAllNetworkSetsOwnedByUserV2(myAccountController.identifier,
                    
                    function (networkSets) {
                        myAccountController.networkSets = _.orderBy(networkSets, ['modificationTime'], ['desc']);
                        successHandler(myAccountController.networkSets[0]);
                    },
                    function (error, status) {
                        console.log("unable to get network sets");
                        errorHandler(error, status);
                    });
            };

            myAccountController.addNetworkSetToTable = function(networkSet) {
                var status = "Set";
                var setName = networkSet.name;
                var setDescription = $scope.stripHTML(networkSet.description);

                var networks = networkSet.networks.length;

                var setId = networkSet['externalId'];

                var setReference = uiMisc.getSetReferenceObj(networkSet);

                var setDisease   = "";
                var setTissue    = "";
                var setEdges     = "";
                var setVisibility = networkSet['visibility'] ? networkSet['visibility'] : "PUBLIC";
                var setOwner = sharedProperties.getCurrentUserAccountName();

                var setModified = new Date(networkSet['modificationTime']);

                var setShowcased = networkSet['showcased'];

                var row =   {
                    "Status"        :   status,
                    "Network Name"  :   setName,
                    " "             :   "",
                    "Format"        :   status,
                    "Reference"     :   setReference,
                    "Disease"       :   setDisease,
                    "Tissue"        :   setTissue,
                    //"Nodes"         :   nodes,
                    "Edges"         :   setEdges,
                    "Visibility"    :   setVisibility,
                    "Owner"         :   setOwner,
                    "Last Modified" :   setModified,
                    "Show"          :   setShowcased,
                    "description"   :   setDescription,
                    "externalId"    :   setId,
                    "ownerUUID"     :   networkSet['ownerId'],
                    "name"          :   setName,
                    "errorMessage"  :   "",
                    "subnetworks"   :   0,
                    "networks"      :   networks
                };
                $scope.networkGridOptions.data.push(row);
            };

            myAccountController.adminCheckBoxClicked = function()
            {
                var member = (myAccountController.groupSearchAdmin) ? "GROUPADMIN" : null;

                myAccountController.groupSearchMember = false;

                myAccountController.getUserGroupMemberships(member);
            };

            myAccountController.memberCheckBoxClicked = function()
            {
                var member = (myAccountController.groupSearchMember) ? "MEMBER" : null;

                myAccountController.groupSearchAdmin = false;

                myAccountController.getUserGroupMemberships(member);
            };
            
            myAccountController.deleteTask = function (taskUUID)
            {
                ndexService.deleteTaskV2(taskUUID,
                    function (data)
                    {
                        myAccountController.refreshTasks();
                    },
                    function (error)
                    {
                        console.log("unable to delete task");
                    }
                )
            };

            myAccountController.refreshTasks = function ()
            {
                ndexService.getUserTasksV2(
                    "ALL",
                    0,
                    100,
                    // Success
                    function (tasks)
                    {
                        myAccountController.tasks = tasks;
                    },
                    function (error)
                    {
                        console.log("unable to get user's tasks");
                    }
                )
            };

            myAccountController.refreshRequests = function ()
            {
                getRequests();
            };

            // local functions

            var getUsersUUIDs = function(requests) {
                var UUIDs = [];

                if (!requests || requests.length == 0) {
                    return UUIDs;
                }

                for (var i=0; i<requests.length; i++) {
                    var requesterId = requests[i].requesterId;

                    if (UUIDs.indexOf(requesterId) < 0) {
                        UUIDs.push(requesterId);
                    }
                }

                return UUIDs;
            }

            var getNamesOfRequesters = function(requests, users) {

                if (!users || !requests || users.length == 0 || requests.length == 0) {
                    return;
                }

                for (var i = 0; i < requests.length; i++) {
                    var requesterId = requests[i].requesterId;

                    for (var j = 0; j < users.length; j++) {
                        if (requesterId == users[j].externalId) {
                            requests[i].sourceName = users[j].firstName + " " + users[j].lastName;
                            continue;
                        }
                    }
                }
            }

            var getRequests = function ()
            {
                // get all user pending requests
                ndexService.getUserPermissionRequestsV2(myAccountController.identifier, "received",
                    function (requests)
                    {
                        var userUUIDs = getUsersUUIDs(requests);

                        ndexService.getUsersByUUIDsV2(userUUIDs)
                            .success(
                                function (userList) {
                                    // make sure that sourceName has "First Name  Second Name" instead of "Account Name"
                                    getNamesOfRequesters(requests, userList);

                                    myAccountController.pendingRequests = requests;

                                    // get all group pending requests
                                    ndexService.getUserMembershipRequestsV2(myAccountController.identifier, "received",
                                        function (requests)
                                        {
                                            if (requests && requests.length > 0) {
                                                myAccountController.pendingRequests =
                                                    myAccountController.pendingRequests.concat(requests);
                                            }
                                        },
                                        function (error)
                                        {
                                            console.log("unable to get pending requests");
                                        });
                                })
                            .error(
                                function(error) {
                                    console.log("unable to get users by UUIDs");
                                }
                            )

                    },
                    function (error)
                    {
                        console.log("unable to get pending requests");
                    });

                // get all user sent requests
                ndexService.getUserPermissionRequestsV2(myAccountController.identifier, "sent",
                    function (requests)
                    {
                        var userUUIDs = getUsersUUIDs(requests);

                        ndexService.getUsersByUUIDsV2(userUUIDs)
                            .success(
                                function (userList) {
                                    // make sure that sourceName has "First Name  Second Name" instead of "Account Name"
                                    getNamesOfRequesters(requests, userList);

                                    myAccountController.sentRequests = requests;

                                    // get all group sent requests
                                    ndexService.getUserMembershipRequestsV2(myAccountController.identifier, "sent",
                                        function (requests)
                                        {
                                            if (requests && requests.length > 0) {
                                                myAccountController.sentRequests =
                                                    myAccountController.sentRequests.concat(requests);
                                            }
                                        },
                                        function (error)
                                        {
                                            console.log("unable to get sent requests");
                                        });
                                })
                            .error(
                                function(error) {
                                    console.log("unable to get users by UUIDs");
                                }
                            )
                    },
                    function (error)
                    {
                        console.log("unable to get sent requests");
                    })

            };

            myAccountController.getUserAccountPageNetworks = function (successHandler, errorHandler)
            {
                var directOnly = false;
                ndexService.getUserNetworkPermissionsV2(myAccountController.identifier, 'READ', 0, 1000000, directOnly,
                    function (networkPermissionsMap) {

                        ndexService.getUserAccountPageNetworksV2(myAccountController.identifier,
                            function(networkSummaries) {
                                myAccountController.networkSearchResults = networkSummaries;

                                myAccountController.networksWithAdminAccess = [];
                                myAccountController.networksWithWriteAccess = [];

                                // loop through the network summaries and fill in lists of UUIDs
                                // for networks with ADMIN and WRITE permissions
                                _.forEach(myAccountController.networkSearchResults, function (networkSummaryObj) {

                                    var networkUUID = networkSummaryObj.externalId;

                                    if (networkUUID in networkPermissionsMap) {
                                        var networkPermission = networkPermissionsMap[networkUUID];

                                        if (networkPermission) {
                                            networkPermission = networkPermission.toUpperCase();

                                            if (networkPermission == "ADMIN") {
                                                myAccountController.networksWithAdminAccess.push(networkUUID);
                                            } else if (networkPermission == "WRITE") {
                                                myAccountController.networksWithWriteAccess.push(networkUUID);
                                            };
                                        };
                                    };

                                    var noOfSubNetworks = uiMisc.getNoOfSubNetworks(networkSummaryObj);

                                    if (noOfSubNetworks > 1) {
                                        myAccountController.networksWithMultipleSubNetworks[networkUUID] = noOfSubNetworks;
                                    };
                                });
                                successHandler();
                            },
                            function(error) {
                               console.log("unable to get user account page networks");
                               errorHandler();
                            });

                    },
                    function (error, data) {
                        console.log("unable to get user network memberships");
                    });
            };

            $scope.showWarningsOrErrors = function(rowEntity) {

                if (!rowEntity && !rowEntity.externalId) {
                    return;
                }

                if (rowEntity.subnetworks > 1) {
                    var title = "Warning";
                    var message = "This network is part of a Cytoscape collection with " +
                        rowEntity.subnetworks + " subnetworks and cannot be edited in NDEx."
                    ndexNavigation.genericInfoModal(title, message);
                } else {
                    uiMisc.showNetworkWarningsOrErrors(rowEntity, myAccountController.networkSearchResults);
                };  
            };

            $scope.switchShowcase = function(row) {
                if (row && row.entity) {

                    var show = !row.entity.Show;

                    //row.entity.Show = !row.entity.Show;

                    if (row.entity.Status == 'Set') {

                        var setToShowcase = _.find(myAccountController.networkSets, {'externalId': row.entity.externalId});

                        if (show) {
                            var networksIds = (setToShowcase.networks) ? setToShowcase.networks : [];
                            var privateNetworksCount = 0;

                            _.forEach(myAccountController.networkSearchResults, function (network) {
                                if (_.includes(networksIds, network.externalId)) {
                                    if (network.visibility.toUpperCase() == "PRIVATE") {
                                        privateNetworksCount = privateNetworksCount + 1;
                                    };
                                };
                            });

                            if (privateNetworksCount > 0) {

                                if (privateNetworksCount == 1) {
                                    var message = privateNetworksCount + "  network in this Set is private " +
                                        " and will not be visible to other users. <br><br>";
                                } else {
                                    var message = privateNetworksCount + " networks in this Set are private " +
                                        " and will not be visible to other users. <br><br>";
                                };

                                var title = "Activate Showcase function";
                                message = message + "Do you want to proceed and activate the Showcase function?";

                                ndexNavigation.openConfirmationModal(title, message, "Proceed", "Cancel",
                                    function () {
                                        ndexService.updateNetworkSetSystemPropertiesV2(row.entity.externalId, "showcase", show,
                                            function (data, networkId, property, value) {
                                                row.entity.Show = !row.entity.Show; // success
                                                setToShowcase['showcased'] = row.entity.Show;
                                            },
                                            function (error, setId, property, value) {
                                                console.log("unable to update showcase for Network Set with Id " + setId);
                                            });
                                    },
                                    function () {
                                        // User selected Cancel; return
                                        return;
                                    });

                            } else {

                                // turning on showcase for a Set with no private networks
                                ndexService.updateNetworkSetSystemPropertiesV2(row.entity.externalId, "showcase", show,
                                    function (data, networkId, property, value) {
                                        row.entity.Show = !row.entity.Show; // success
                                        setToShowcase['showcased'] = row.entity.Show;
                                    },
                                    function (error, setId, property, value) {
                                        console.log("unable to update showcase for Network Set with Id " + setId);
                                    });
                            }
                        } else {

                            // turning off showcase for a Set
                            ndexService.updateNetworkSetSystemPropertiesV2(row.entity.externalId, "showcase", show,
                                function (data, networkId, property, value) {
                                    row.entity.Show = !row.entity.Show; // success
                                    setToShowcase['showcased'] = row.entity.Show;
                                },
                                function (error, setId, property, value) {
                                    console.log("unable to update showcase for Network Set with Id " + setId);
                                });
                        };

                    } else {

                        // turning on/off showcase for a network
                        ndexService.setNetworkSystemPropertiesV2(row.entity.externalId, "showcase", show,
                            function (data, networkId, property, value) {
                                row.entity.Show = !row.entity.Show; // success
                            },
                            function (error, networkId, property, value) {
                                console.log("unable to update showcase for Network with Id " + networkId);
                            });
                    };
                };
            };

            $scope.getNetworkURL = function(networkUUID) {
                return "#/network/" + networkUUID;
            };

            $scope.getNetworkDownloadLink = function(rowEntity) {
                return uiMisc.getNetworkDownloadLink(myAccountController, rowEntity);
            };

            $scope.isOwnerOfNetwork = function(networkOwnerUUID)
            {
                if (!myAccountController.isLoggedInUser) {
                    return false;
                }
                return (myAccountController.loggedInIdentifier == networkOwnerUUID);
            }

            $scope.failedNetworkWarning = function(rowEntity) {
                var networkName  = rowEntity.name;
                var errorMessage = rowEntity.errorMessage;
                var status       = rowEntity.Status;
                var networkUUID  = rowEntity.externalId;


                var title = "This Network is Invalid";
                var body  =
                    "<strong>Name: </strong>" + networkName + "<br>" +
                    "<strong>Status: </strong>" + status + "<br>" +
                    "<strong>Error Message: </strong>" + errorMessage + "<br><br>" +
                    "<strong>Would you like to permanently DELETE this network?</strong>"
                
                ndexNavigation.openConfirmationModal(title, body, "Delete", "Cancel",
                    function () {
                        ndexService.deleteNetworkV2(networkUUID,
                            function (data)
                            {
                                // remove deleted network from myAccountController.networkSearchResults
                                for (var i = myAccountController.networkSearchResults.length - 1; i >= 0; i--)
                                {
                                    var externalId = myAccountController.networkSearchResults[i].externalId;
                                    if (externalId == networkUUID) {
                                        myAccountController.networkSearchResults.splice(i, 1);
                                        refreshNetworkTable();
                                        break;
                                    }
                                }
                            },
                            function (error)
                            {
                                console.log("unable to delete network");
                            });

                    },
                    function () {
                        // User selected Cancel; do not do anything here
                    });

                return;
            };


            //                  PAGE INITIALIZATIONS/INITIAL API CALLS
            //----------------------------------------------------------------------------

            ndexService.getUserByUUIDV2(myAccountController.identifier)
                .success(
                function (user)
                {
                    myAccountController.displayedUser = user;

                    $scope.diskSpaceInfo = uiMisc.showAvailableDiskSpace(user);

                    cUser = user;

                    // get requests
                    getRequests();

                    //get tasks
                    myAccountController.refreshTasks();

                    // get networks
                    myAccountController.getUserAccountPageNetworks(
                        function() {
                            populateNetworkTable();

                            ndexService.getAllNetworkSetsOwnedByUserV2(myAccountController.identifier,

                                function (networkSets) {
                                    myAccountController.networkSets = _.orderBy(networkSets, ['modificationTime'], ['desc']);

                                    _.forEach(myAccountController.networkSets, function(networkSet) {
                                        myAccountController.addNetworkSetToTable(networkSet);
                                    });
                                },
                                function (error, status, headers, config, statusText) {
                                    console.log("unable to get network sets");
                                });
                        },
                        function() {

                        }
                    );

                    // get groups
                    var member = null;
                    myAccountController.getUserGroupMemberships(member);
                })
        }]);

            //------------------------------------------------------------------------------------//
