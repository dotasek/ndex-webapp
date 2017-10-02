/**
 * Created by chenjing on 5/5/16.
 */


ndexServiceApp.factory('provenanceService', ['ndexService','$location', '$filter',
    function (ndexService, $location, $filter) {

        var factory = {};
        
        var provenance = undefined;
        
        var extractUuidFromUri = function( uri )
        {
            if (uri == null)
                return null;

            var uuidRegExPattern = /[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}/i;

            var n = uri.search(uuidRegExPattern);
            return  uri.substr(n, 36);
        };

        var extractHostFromUri = function( uri )
        {
            var parser = document.createElement('a');
            parser.href = uri;
            return parser.protocol + "//" + parser.host;
        };


        var generateWebAppUrlFromUuid = function(uuid)
        {
            var baseUrl = $location.absUrl();
            baseUrl = baseUrl.substring( 0, baseUrl.indexOf( $location.url() ) );

            return baseUrl + "/network/" + uuid;
        };

        factory.resetProvenance = function () {provenance = undefined;};

        factory.getNetworkProvenance = function (networkId, onSuccess, onError) {
            if (provenance) {
                onSuccess(provenance);
            } else {
                ndexService.getNetworkProvenanceV2(networkId,
                    function (data) {
                        provenance = data;
                        onSuccess(provenance);
                    }, function (error) {
                        onError(error);

                    });
            }

        };


   /*     factory.getProvenanceTitle = function()
        {
            var untitled = "Untitled Network";

            if( typeof provenance == 'undefined' || provenance.properties == null )
                return untitled;

            for( var i = 0; i < provenance.properties.length; i++ )
            {
                var p = provenance.properties[i];
                if(p.name.toLowerCase() == "dc:title")
                    return p.value;
            }
            return untitled; //provenance.uri;
        }; */

        factory.getProvenanceTitle = function(prov)
        {
            var untitled = "Untitled Network";

            if( typeof prov == 'undefined' || prov.properties == null )
                return untitled;

            for( var i = 0; i < prov.properties.length; i++ )
            {
                var p = prov.properties[i];
                if(p.name.toLowerCase() == "dc:title")
                    return p.value;
            }
            return untitled; //provenance.uri;
        };

        factory.showProvenance = function (controller) {
            if (!provenance) {
                ndexService.getNetworkProvenanceV2(controller.currentNetworkId,
                    function (data) {

                    provenance = data;
                    build_provenance_view(controller);
                }, function (error) {
                    controller.showRetrieveMessage = false;
                    if ((error != null) && (typeof error.message !== 'undefined')) {
                        controller.errors.push({
                            label: "Unable to retrieve network provenance: ",
                            error: error.message
                        });
                    } else {
                        networkController.errors.push({
                            label: "Unable to retrieve network provenance: ",
                            error: "Unknown error"
                        });
                    }
                });
            } else
                build_provenance_view(controller);  
        };

        var buildGraph;
        buildGraph = function (currentNetworkId, prov, level, parent_node, edge_label, merge, nodes, edges, provMap) {
            var node_id = nodes.length;

            var node = {
                id: node_id,
                label: factory.getProvenanceTitle(prov),
                level: level
            };

            nodes.push(node);
            provMap[node_id] = prov;
            if (prov.uri) {
                var uuid = extractUuidFromUri(prov.uri);
                provMap[node_id].uuid = uuid;
                provMap[node_id].host = extractHostFromUri(prov.uri);
                if (uuid !== currentNetworkId) {
                    //Check and see if the UUID is on this server, if so, set the webapp url. Otherwise, it should
                    //not be set.
                    (ndexService.getNetworkSummaryV2(uuid) )
                        .success(function () {
                                provMap[node_id].webapp_url = generateWebAppUrlFromUuid(uuid);
                            }
                        )
                        .error(function (error) {

                            }
                        );
                }
            }

            if (parent_node != -1) {
                var edge = {
                    to: parent_node,
                    from: node_id
                };

                if (!merge) {
                    edge.label = edge_label;

                }
                edges.push(edge);
            }

            var inputs = (prov.creationEvent != null ) ? prov.creationEvent.inputs : null;
            if (inputs != null) {
                if (inputs.length > 1) {
                    var join_id = node_id + 1;
                    level++;
                    var join_node = {
                        id: join_id,
                        label: "",
                        level: level
                    };
                    nodes.push(join_node);
                    var join_edge = {
                        to: node_id,
                        from: join_id,
                        label: prov.creationEvent.eventType + "\non\n" + $filter('date')(prov.creationEvent.endedAtTime, 'mediumDate')
                    };
                    edges.push(join_edge);
                    node_id = join_id;
                    merge = true;
                }
                else {
                    merge = false;
                }

                for (var i = 0; i < inputs.length; i++) {
                    var edgeLabel = prov.creationEvent.eventType + "\non\n" + $filter('date')(prov.creationEvent.endedAtTime, 'mediumDate');
                    buildGraph(currentNetworkId, inputs[i], level + 1, node_id, edgeLabel, merge, nodes, edges, provMap);
                }
            }
            else {

                if (prov.creationEvent != null) {

                    var start_node = {
                        id: node_id + 1,
                        label: 'Start',
                        level: level + 1
                    };
                    nodes.push(start_node);

                    var tmpEdge = {
                        to: node_id,
                        from: node_id + 1,
                        label: prov.creationEvent.eventType + "\non\n" + $filter('date')(prov.creationEvent.endedAtTime, 'mediumDate')
                    };

                    edges.push(tmpEdge)
                }
            }

        };




        var build_provenance_view = function(controller)
        {
            var nodes = [];
            var edges = [];
            var provMap = [];

            buildGraph(controller.currentNetworkId, provenance, 1, -1, '', false, nodes, edges, provMap);

            // create a network
            var container = document.getElementById('provenanceNetwork');
            var data = {
                nodes: nodes,
                edges: edges
            };
            var options = {
                width: '100%',
                height: '600px',
                stabilize: false,
                smoothCurves: false,
                hierarchicalLayout: {
                    direction: 'UD'
                },
                hover: true,
                selectable: false,
                edges: {
                    fontFace: 'helvetica',
                    width: 2,
                    style: 'arrow',
                    color: 'silver',
                    fontColor: 'black',
                    widthSelectionMultiplier: 1
                },
                nodes: {
                    // default for all nodes
                    fontFace: 'helvetica',
                    shape: 'box',
                    color: {
                        border: 'lightgreen',
                        background: 'lightgreen',
                        hover: {
                            border: 'orange',
                            background: 'orange'
                        }
                    }

                }
            };

            controller.displayProvenance = provMap[0];
       //     $scope.displayProvenance = provMap[0];

            var network = new vis.Network(container, data, options);
            network.lastHover = 0;

            network.moveTo(
                {
                    position: {
                        x: '0',
                        y: '400'
                    },
                    scale: '1'
                }
            );

            network.on('hoverNode', function (properties) {

                var node_id = properties.node;
                var node = this.nodes[node_id];
                //This is the start node. Don't highlight it.
                if( node.label == "Start" )
                {
                    node.hover=false;
                    return;
                }
                var hover_id = this.lastHover;
                var lastHoverNode = this.nodes[hover_id];
                lastHoverNode.hover=false;
                node.hover=true;
                this.lastHover = node_id;
                if (typeof provMap[node_id] == 'undefined')
                    return;
              /*  $scope.$apply(function(){
                    controller.displayProvenance = provMap[node_id];
                }); */

                controller.refreshProvMap(provMap[node_id]);

            });

            network.on('blurNode', function (properties) {
                var node_id = properties.node;
                var node = this.nodes[node_id];
                node.hover=true;
            });

            network.nodes[0].hover = true;
        };



        return factory;

    }
]);