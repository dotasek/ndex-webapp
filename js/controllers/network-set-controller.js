ndexApp.controller('networkSetController',
    ['ndexService', 'ndexUtility', 'ndexNavigation', 'sharedProperties', '$scope', '$location', '$routeParams', '$modal', '$route', 'uiMisc',
        function (ndexService, ndexUtility, ndexNavigation, sharedProperties, $scope, $location, $routeParams, $modal, $route, uiMisc) {

    //              Process the URL to get application state
    //-----------------------------------------------------------------------------------
    var identifier = $routeParams.identifier;


    //              CONTROLLER INTIALIZATIONS
    //------------------------------------------------------------------------------------

    $scope.networkSetController = {};
    var networkSetController = $scope.networkSetController;

    networkSetController.identifier = identifier;

    // networks
    networkSetController.networkSearchResults = [];
    networkSetController.errors = [];

    networkSetController.networkTableRowsSelected = 0;

    networkSetController.isLoggedInUser = (ndexUtility.getLoggedInUserAccountName() != null);

    //              scope functions
    // called on Networks belonging to group displayed on page
    networkSetController.setAndDisplayCurrentNetwork = function (identifier) {
        $location.path("/network/" + identifier);
    };

    networkSetController.getNetworksOfNetworkSet = function() {

        ndexService.getNetworkSetV2(networkSetController.identifier,
            
                function (networkSetInformation) {
                    var networkUUIDs = networkSetInformation["networks"];

                    ndexService.getNetworkSummariesByUUIDsV2(networkUUIDs,
                        function (networkSummaries) {
                            networkSetController.networkSearchResults = networkSummaries;
                            populateNetworkTable();
                        },
                        function (error) {
                            if (error) {
                                displayErrorMessage(error);
                            };
                        });

                },
                function (error) {
                    if (error) {
                        displayErrorMessage(error);
                    }
                });
    };

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

        onRegisterApi: function( gridApi )
        {
            $scope.networkGridApi = gridApi;
            gridApi.selection.on.rowSelectionChanged($scope,function(row){
                var selectedRows = gridApi.selection.getSelectedRows();
                networkSetController.networkTableRowsSelected = selectedRows.length;
            });
            gridApi.selection.on.rowSelectionChangedBatch($scope,function(rows){
                var selectedRows = gridApi.selection.getSelectedRows();
                networkSetController.networkTableRowsSelected = selectedRows.length;
            });
        }
    };

    var populateNetworkTable = function()
    {
        var columnDefs = [
            { field: 'Status', enableFiltering: false, maxWidth: 60, cellTemplate: 'pages/gridTemplates/networkStatus.html', visible: false },
            { field: 'Network Name', enableFiltering: true, cellTemplate: 'pages/gridTemplates/networkName.html'},
            { field: ' ', enableFiltering: false, width:40, cellTemplate: 'pages/gridTemplates/downloadNetwork.html' },
            { field: 'Format', enableFiltering: true, maxWidth:63 },
            { field: 'Ref.', enableFiltering: false, maxWidth: 45, cellTemplate: 'pages/gridTemplates/reference.html' },
            { field: 'Disease', enableFiltering: true, maxWidth: 68, cellTemplate: 'pages/gridTemplates/disease.html'},
            { field: 'Tissue',  enableFiltering: true, maxWidth: 65, cellTemplate: 'pages/gridTemplates/tissue.html'},
            { field: 'Nodes', enableFiltering: false, maxWidth: 70 },
            { field: 'Edges', enableFiltering: false, maxWidth: 70 },
            { field: 'Visibility', enableFiltering: true, maxWidth: 70 },
            { field: 'Owner', enableFiltering: true, maxWidth:80,
                cellTemplate: 'pages/gridTemplates/ownedBy.html'},
            { field: 'Last Modified', enableFiltering: false, maxWidth:120, cellFilter: "date:'short'" }
        ];
        $scope.networkGridApi.grid.options.columnDefs = columnDefs;
        refreshNetworkTable();
    };

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
    }

    var refreshNetworkTable = function()
    {
        $scope.networkGridOptions.data = [];

        for(var i = 0; i < networkSetController.networkSearchResults.length; i++ )
        {
            var network = networkSetController.networkSearchResults[i];
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
            var nodes = network['nodeCount'];
            var edges = network['edgeCount'];
            var owner = network['owner'];
            var visibility = network['visibility'];
            var modified = new Date( network['modificationTime'] );

            var format = uiMisc.getNetworkFormat(subNetworkId, network);
            var download = "Download " + networkName;
            var reference = uiMisc.getNetworkReferenceObj(subNetworkId, network);
            var disease   = uiMisc.getDisease(network);
            var tissue    = uiMisc.getTissue(network);

            var errorMessage = network.errorMessage;

            var row = {
                "Status"        :   networkStatus,
                "Network Name"  :   networkName,
                " "             :   download,
                "Format"        :   format,
                "Reference"     :   reference,
                "Disease"       :   disease,
                "Tissue"        :   tissue,
                "Nodes"         :   nodes,
                "Edges"         :   edges,
                "Visibility"    :   visibility,
                "Owner"         :   owner,
                "Last Modified" :   modified,
                "description"   :   description,
                "externalId"    :   externalId,
                "ownerUUID"     :   network['ownerUUID'],
                "name"          :   networkName,
                "errorMessage"  :   errorMessage,
                "subnetworks"   :   noOfSubNetworks
            };
            $scope.networkGridOptions.data.push(row);
        }
    };

    var displayErrorMessage = function(error) {
        var message = (error && error.message) ? error.message: "Unknown error; Server returned no error information.";
        networkSetController.errors.push(message);
    };


    var removeSelectedNetworksFromSet = function ()
    {
        var selectedNetworksIds = [];

        var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

        _.forEach(selectedNetworksRows, function(row) {
            selectedNetworksIds.push(row.externalId);
        });

        if (selectedNetworksIds.length == 0) {
            return;
        };

        ndexService.deleteNetworksFromNetworkSetV2(networkSetController.identifier, selectedNetworksIds,

            function (data) {

                // after we removed the selected networks, the footer of the table may
                // still show that some networks are selected (must be a bug), so
                // we manually set the selected count to 0 (see defect NDEX-582)
                $scope.networkGridApi.grid.selection.selectedCount = 0;

                for (var i = networkSetController.networkSearchResults.length - 1; i >= 0; i-- )
                {
                    var externalId = networkSetController.networkSearchResults[i].externalId;
                    if  (selectedNetworksIds.indexOf(externalId) != -1) {
                        networkSetController.networkSearchResults.splice(i, 1);
                    };
                }
                refreshNetworkTable();
                networkSetController.networkTableRowsSelected = 0;

            },
            function (error) {
                if (error) {
                    displayErrorMessage(error);
                };
            });

    };


    networkSetController.confirmRemoveSelectedNetworksFromSet = function()
    {
        var modalInstance = $modal.open({
            templateUrl: 'confirmation-modal.html',
            scope: $scope,

            controller: function($scope, $modalInstance) {

                $scope.title = 'Remove Selected Networks';
                $scope.message =
                    'The selected sets networks will be removed from this Set. Are you sure you want to proceed?';

                $scope.cancel = function() {
                    $modalInstance.dismiss();
                    $scope.isProcessing = false;
                };

                $scope.confirm = function() {
                    $scope.isProcessing = true;
                    removeSelectedNetworksFromSet();
                    $modalInstance.dismiss();
                    $scope.isProcessing = false;
                };
            }
        });
    };


    // local functions

    $scope.showWarningsOrErrors = function(rowEntity) {

        if (!rowEntity && !rowEntity.externalId) {
            return;
        }

        uiMisc.showNetworkWarningsOrErrors(rowEntity, networkSetController.networkSearchResults);
    }

    $scope.getNetworkDownloadLink = function(rowEntity) {
        return uiMisc.getNetworkDownloadLink(networkSetController, rowEntity);
    };
            
    $scope.getFirstWordFromDisease = function(diseaseDescription) {

        return uiMisc.getFirstWordFromDisease(diseaseDescription);
    };

    $scope.isOwnerOfNetwork = function(networkOwnerUUID)
    {
        if (!networkSetController.isLoggedInUser) {
            return false;
        }
        return (sharedProperties.getCurrentUserId() == networkOwnerUUID);
    };

    //                  PAGE INITIALIZATIONS/INITIAL API CALLS
    //----------------------------------------------------------------------------
    networkSetController.isLoggedIn = (ndexUtility.getLoggedInUserAccountName() != null);


    networkSetController.getNetworksOfNetworkSet();
    //------------------------------------------------------------------------------------//
}]);