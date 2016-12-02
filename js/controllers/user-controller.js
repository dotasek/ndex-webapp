ndexApp.controller('userController',
    ['ndexService', 'ndexUtility', 'sharedProperties', '$scope', '$location', '$routeParams', '$route', '$modal', 'uiMisc',
        function (ndexService, ndexUtility, sharedProperties, $scope, $location, $routeParams, $route, $modal, uiMisc)
        {

            //              Process the URL to get application state
            //-----------------------------------------------------------------------------------
            var identifier = $routeParams.identifier;


            //              CONTROLLER INTIALIZATIONS
            //------------------------------------------------------------------------------------

            $scope.userController = {};
            var userController = $scope.userController;
            userController.isLoggedInUser = (ndexUtility.getLoggedInUserAccountName() != null);
            userController.identifier = identifier;
            userController.loggedInIdentifier = sharedProperties.getCurrentUserId();
            userController.displayedUser = {};

            //groups
            userController.groupSearchAdmin = false; // this state needs to be saved to avoid browser refresh
            userController.groupSearchMember = false;
            userController.groupSearchResults = [];

            //networks
            userController.networkQuery = {};
            userController.networkSearchResults = [];
            userController.skip = 0;
            userController.skipSize = 10000;
            userController.atLeastOneSelected = false;

            userController.pendingRequests = [];
            userController.sentRequests = [];

            //tasks
            userController.tasks = [];

            userController.showAskForMoreAccessButton = false;

            userController.userPageNetworksUUIDs = [];
            userController.loggedInUsersNetworkPermissionsMap = {};


            var calcColumnWidth = function(header, isLastColumn)
            {
                var result = header.length * 10;
                result = result < 100 ? 100 : result;
                if( isLastColumn )
                    result += 40;
                return result > 250 ? 250 : result;
            };

            //table
            $scope.networkGridOptions =
            {
                enableSorting: true,
                enableFiltering: true,
                showGridFooter: true,
                columnVirtualizationThreshold: 20,
                enableColumnMenus: false,

                onRegisterApi: function( gridApi )
                {
                    $scope.networkGridApi = gridApi;
                    gridApi.selection.on.rowSelectionChanged($scope,function(row){
                        var selectedRows = gridApi.selection.getSelectedRows();
                        userController.atLeastOneSelected = selectedRows.length > 0;

                        showOrHideAskforMoreAccessButton();

                    });
                    gridApi.selection.on.rowSelectionChangedBatch($scope,function(rows){
                        var selectedRows = gridApi.selection.getSelectedRows();
                        userController.atLeastOneSelected = selectedRows.length > 0;

                        showOrHideAskforMoreAccessButton();
                    });

                }
            };

            var populateNetworkTable = function()
            {
                var columnDefs = [
                    { field: 'Status', enableFiltering: false, maxWidth: 55, cellTemplate: 'pages/gridTemplates/networkStatus.html' },
                    { field: 'Network Name', enableFiltering: true, cellTemplate: 'pages/gridTemplates/networkName.html'},
                    { field: 'Disease', enableFiltering: true, maxWidth: 65, cellTemplate: 'pages/gridTemplates/disease.html'},
                    { field: ' ', enableFiltering: false, width:40, cellTemplate: 'pages/gridTemplates/downloadNetwork.html' },
                    { field: 'Reference', enableFiltering: false, maxWidth: 76, cellTemplate: 'pages/gridTemplates/reference.html' },
                    { field: 'Nodes', enableFiltering: false, maxWidth:70 },
                    { field: 'Edges', enableFiltering: false, maxWidth:70 },
                    { field: 'Visibility', enableFiltering: true, maxWidth:70 },
                    { field: 'Owned By', enableFiltering: true, maxWidth:80,
                        cellTemplate: 'pages/gridTemplates/ownedBy.html'},
                    { field: 'Last Modified', enableFiltering: false, maxWidth:120, cellFilter: "date:'short'",  sort: {direction: 'desc', priority: 0}},

                    { field: 'description', enableFiltering: false,  visible: false},
                    { field: 'externalId',  enableFiltering: false,  visible: false},
                    { field: 'ownerUUID',   enableFiltering: false,  visible: false},
                    { field: 'name',        enableFiltering: false,  visible: false}
                ];
                $scope.networkGridApi.grid.options.columnDefs = columnDefs;
                refreshNetworkTable();
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
            
            var showOrHideAskforMoreAccessButton = function() {
                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();

                if (selectedNetworksRows.length == 0) {
                    // nothing is selected (all rows un-selected)
                    userController.showAskForMoreAccessButton = false;
                    return;
                }

                var loggedInUserId = ndexUtility.getLoggedInUserExternalId();

                for (var i = 0; i < selectedNetworksRows.length; i++) {
                    var networkUUID = selectedNetworksRows[i].externalId;
                    var ownerUUID = selectedNetworksRows[i].ownerUUID;

                    if (ownerUUID == loggedInUserId) {
                        // if there is at least one network owned by Logged In User (s)he selected
                        // on a Users page, we do not show the Ask For More Access button.
                        userController.showAskForMoreAccessButton = false;
                        return;
                    }

                    if (networkUUID in userController.loggedInUsersNetworkPermissionsMap) {
                        var permission = userController.loggedInUsersNetworkPermissionsMap[networkUUID];

                        if (permission && (permission.toUpperCase()=="WRITE" || (permission.toUpperCase()=="ADMIN"))) {
                            // if there is at least one network among selected networks on the User page where
                            // Logged In User has WRITE or ADMIN privileges (there should be no networks with ADMIN
                            // privilege for the logged in user on a User page though),
                            // we do not show the Ask For More Access button.
                            userController.showAskForMoreAccessButton = false;
                            return;
                        }
                    }
                }

                userController.showAskForMoreAccessButton = true;
            }

            
            var refreshNetworkTable = function()
            {
                $scope.networkGridOptions.data = [];

                for(var i = 0; i < userController.networkSearchResults.length; i++ )
                {
                    var network = userController.networkSearchResults[i];

                    var networkName = (!network['name']) ? "No name; UUID : " + network.externalId : network['name'];

                    var networkStatus = "success";
                    if (!network.isValid) {
                        if (network.errorMessage) {
                            networkStatus = "failed";
                        } else {
                            networkStatus = "processing";
                        }
                    }

                    if ((networkStatus == "success") && network.warnings && network.warnings.length > 0) {
                        networkStatus = "warning";
                    }

                    var description = $scope.stripHTML(network['description']);
                    var externalId = network['externalId'];
                    var nodes = network['nodeCount'];
                    var edges = network['edgeCount'];
                    var owner = network['owner'];
                    var visibility = network['visibility'];
                    var modified = new Date( network['modificationTime'] );

                    var download = "Download " + networkName;
                    var reference = uiMisc.getNetworkReferenceObj(network);
                    var disease   = uiMisc.getDisease(network);

                    var row = {
                        "Status"        :   networkStatus,
                        "Network Name"  :   networkName,
                        "Disease"       :   disease,
                        " "             :   download,
                        "Reference"     :   reference,
                        "Nodes"         :   nodes,
                        "Edges"         :   edges,
                        "Visibility"    :   visibility,
                        "Owned By"      :   owner,
                        "Last Modified" :   modified,
                        "description"   :   description,
                        "externalId"    :   externalId,
                        "ownerUUID"     :   network['ownerUUID'],
                        "name"          :   networkName
                    };
                    $scope.networkGridOptions.data.push(row);
                }
            };

            userController.deleteSelectedNetworks = function ()
            {
                var selectedIds = [];

                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();
                for( var i = 0; i < selectedNetworksRows.length; i ++ )
                {
                    selectedIds.push(selectedNetworksRows[i].externalId);
                }
                for (i = 0; i < selectedIds.length; i++ )
                {
                    var selectedId = selectedIds[i];
                    ndexService.deleteNetworkV2(selectedId,
                        function (data)
                        {

                        },
                        function (error)
                        {

                        });
                }

                // after we deleted all selected networks, the footer of the table may
                // still show that some networks are selected (must be a bug), so
                // we manually set the selected count to 0 (see defect NDEX-582)
                $scope.networkGridApi.grid.selection.selectedCount = 0;

                for (i = userController.networkSearchResults.length - 1; i >= 0; i-- )
                {
                    var externalId = userController.networkSearchResults[i].externalId;
                    if( selectedIds.indexOf(externalId) != -1 )
                        userController.networkSearchResults.splice(i,1);
                }
                refreshNetworkTable();
                userController.atLeastOneSelected = false;
            };

            userController.getUserGroupMemberships = function (member)
            {
                /*
                 * To get list of Group objects we need to:
                 *
                 * 1) Use getUserGroupMemberships function at
                 *    /user/{userId}/group/{permission}/skipBlocks/blockSize?inclusive=true;
                 *    to get the list of GROUPADMIN and MEMBER memberships
                 *
                 * 2) Get a list of Group UUIDs from step 1
                 *
                 * 3) Use this list of Group UUIDs to get Groups through
                 *    /group/groups API.
                 */
                ndexService.getUserGroupMembershipsV2(userController.identifier, member, 0, 1000000,
                        function (userMembershipsMap) {

                            var groupsUUIDs = Object.keys(userMembershipsMap);

                            ndexService.getGroupsByUUIDsV2(groupsUUIDs)
                                .success(
                                    function (groupList) {
                                        userController.groupSearchResults = groupList;
                                    })
                                .error(
                                    function(error) {
                                        console.log("unable to get groups by UUIDs");
                                    }
                                )
                        },
                        function (error, data) {
                            console.log("unable to get user group memberships");
                        });
            }

            userController.getIDsOfSelectedNetworks = function ()
            {
                var selectedIds = [];

                var selectedNetworksRows = $scope.networkGridApi.selection.getSelectedRows();
                for( var i = 0; i < selectedNetworksRows.length; i ++ )
                {
                    selectedIds.push(selectedNetworksRows[i].externalId);
                }

                return selectedIds;
            };

            userController.adminCheckBoxClicked = function()
            {
                var member = (userController.groupSearchAdmin) ? "GROUPADMIN" : null;

                userController.groupSearchMember = false;

                userController.getUserGroupMemberships(member);
            };

            userController.memberCheckBoxClicked = function()
            {
                var member = (userController.groupSearchMember) ? "MEMBER" : null;

                userController.groupSearchAdmin = false;

                userController.getUserGroupMemberships(member);
            };

            userController.submitNetworkSearch = function ()
            {
                userController.networkSearchResults = [];

                // We are getting networks of some user. This is the scenario where we click a user/account name
                // from the list of found networks on the Network search page (when we are logged in or anonymously)
                
                userController.networkQuery.accountName = cUser.userName;

                ndexService.searchNetworksV2(userController.networkQuery, userController.skip, userController.skipSize,
                    function (networks)
                    {
                        userController.networkSearchResults = networks.networks;

                        populateNetworkTable();
                    },
                    function (error)
                    {
                        console.log(error);
                    });
            }

            userController.getUserShowcaseNetworks = function ()
            {
                ndexService.getUserShowCaseNetworksV2(userController.identifier,
                    function (networks)
                    {
                        userController.networkSearchResults = networks;

                        var directOnly = false;
                        var loggedInUserId = ndexUtility.getLoggedInUserExternalId();

                        // get IDs of all networks shown on User page
                        getNetworksUUIDs(networks);


                        if (userController.userPageNetworksUUIDs.length > 0) {
                            // get permissions of all networks for the logged in user
                            ndexService.getUserNetworkPermissionsV2(loggedInUserId, 'READ', 0, 1000000, directOnly,
                                function (networkPermissionsMap) {
                                    userController.loggedInUsersNetworkPermissionsMap = networkPermissionsMap;
                                },
                                function (error, data) {
                                    console.log("unable to get user network memberships");
                                });
                        }

                        populateNetworkTable();
                    },
                    function (error)
                    {
                        console.log("unable to get user show case networks");
                    });
            }

            userController.refreshRequests = function ()
            {
                getRequests();
            };



            //  local functions

            var getNetworksUUIDs = function(networks) {
                userController.userPageNetworksUUIDs = [];

                if (!networks || networks.length == 0) {
                    return;
                }

                for (var i=0; i<networks.length; i++) {
                    var networkUUID = networks[i].externalId;

                    if (userController.userPageNetworksUUIDs.indexOf(networkUUID) < 0) {
                        userController.userPageNetworksUUIDs.push(networkUUID);
                    }
                }
            }

            var getRequests = function ()
            {
                // get all pending requests
                ndexService.getUserPermissionRequestsV2(userController.identifier, "received",
                    function (requests)
                    {
                        userController.pendingRequests = requests;
                    },
                    function (error)
                    {
                        console.log("unable to get pending requests");
                    });

                // get all sent requests
                ndexService.getUserPermissionRequestsV2(userController.identifier, "sent",
                    function (requests)
                    {
                        userController.sentRequests = requests;
                    },
                    function (error)
                    {
                        console.log("unable to get sent requests");
                    })
            };

            $scope.showWarningsOrErrors = function(rowEntity) {

                if (!rowEntity && !rowEntity.externalId) {
                    return;
                }

                uiMisc.showNetworkWarningsOrErrors(rowEntity, userController.networkSearchResults);
            };

            $scope.getNetworkFromServerAndSaveToDisk = function(rowEntity) {

                uiMisc.getNetworkFromServerAndSaveToDisk(rowEntity);
            };

            $scope.getFirstWordFromDisease = function(diseaseDescription) {

                return uiMisc.getFirstWordFromDisease(diseaseDescription);
            };

            //                  PAGE INITIALIZATIONS/INITIAL API CALLS
            //----------------------------------------------------------------------------


            if ((identifier === userController.loggedInIdentifier) || (identifier === $scope.main.userName)) {
                
                $location.path("/myAccount");    // redirect to My Account page

            } else {

                ndexService.getUserByUUIDV2(userController.identifier)
                    .success(
                    function (user)
                    {
                        userController.displayedUser = user;

                        cUser = user;

                        // get groups. Server-side API requires authentication,
                        // so only show groups if a user is logged in.
                        if (userController.isLoggedInUser) {
                            var member = null;
                            userController.getUserGroupMemberships(member);
                        }

                        // get networks
                        //userController.submitNetworkSearch();

                        userController.getUserShowcaseNetworks();
                    })
                }

            }]);


//------------------------------------------------------------------------------------//
