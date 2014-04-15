Triptych.BEL3DVisualizer = function(){
	this.displayValueBars = true;
};

Triptych.BEL3DVisualizer.prototype = new Triptych.WebGLVisualizer();

Triptych.BEL3DVisualizer.prototype.constructor = Triptych.BEL3DVisualizer;

//-------------------------------------------------------
//
// Displayers
//
//-------------------------------------------------------

Triptych.BEL3DNodeDisplayer = function(){
	this.plainMaterialName = "grayMaterial";
	this.selectMaterialName = "defaultSurfaceSelectedMaterial";
	this.highlightMaterialName = "defaultSurfaceHighlightedMaterial";
};

Triptych.BEL3DNodeDisplayer.prototype = new Triptych.WebGLNodeDisplayer();

Triptych.BEL3DNodeDisplayer.prototype.constructor = Triptych.BEL3DNodeDisplayer;

Triptych.BEL3DNodeDisplayer.prototype.updateMain = function(node){
	if (!node.displayList.main){
		node.displayList.main = this.makeMain(node);
		this.visualizer.addElement(node.displayList.main, node, 'main');
	} 
	if (!node.displayList.valueBar){
		node.displayList.valueBar = this.visualizer.makeValueBar(this.visualizer.resources[this.plainMaterialName]);
		this.visualizer.addElement(node.displayList.valueBar, node, 'valueBar');
	}
	var val = 0;
	if (node.perturbationStep != null && node.perturbationStep <= this.visualizer.timeLoop.step && node.values && node.values.length > 1){
		
		var firstIndex = this.visualizer.timeLoop.step;
		var delta;
		if (firstIndex == node.values.length -1){
			delta = node.values[0] - node.values[firstIndex];
		} else {
			delta = node.values[firstIndex + 1] - node.values[firstIndex];
		}
		val = node.values[firstIndex] + delta * this.visualizer.timeLoop.stepFraction;
		if (val > 0){		
			node.displayList.main.material = this.visualizer.resources.redMaterial;
		} else {
			node.displayList.main.material = this.visualizer.resources.greenMaterial;
		}		
	} else if (node.selected || node.perturbationStep != null){ 
		this.select(node);
	} else if (node.highlighted){
		this.highlight(node);
	} else {
		this.plain(node);
	}
	if (this.visualizer.displayValueBars && val && val != 0){
		node.displayList.valueBar.visible = true;
		node.displayList.valueBar.position.copy(node.position);
		var scale = Math.abs(val);
		node.displayList.valueBar.scale.z = scale;
		var barLength = scale * this.visualizer.edgeReferenceLength;
		if (val > 0){
			node.displayList.valueBar.position.z = node.position.z +  14;
			node.displayList.valueBar.material = this.visualizer.resources.redMaterial;
		} else {
			node.displayList.valueBar.position.z = node.position.z - (14 + barLength);
			node.displayList.valueBar.material = this.visualizer.resources.greenMaterial;
		}
	} else {
		node.displayList.valueBar.visible = false;
	}		
	node.displayList.main.position.copy(node.position);
};

Triptych.BEL3DNodeDisplayer.prototype.updateLabel = function(node){
	if (this.visualizer.showLabels || node.selected || node.highlighted || node.perturbationStep != null){
		if (!node.displayList.label) {
			node.displayList.label = this.makeLabel(node);
			this.visualizer.addElement(node.displayList.label, node, 'label');
		}
		var pos = node.displayList.label.position;
		pos.copy(node.position);
		pos.add(this.visualizer.camera.up.clone().multiplyScalar(20));
		var vectorToCamera = this.visualizer.camera.position.clone().sub( pos );
		
		pos.add(vectorToCamera.normalize().multiplyScalar(20));
		node.displayList.label.visible = true

	} else if (node.displayList.label){
		node.displayList.label.visible = false;
	}
};
/*
Triptych.BEL3DNodeDisplayer.prototype.animate = function(node){
	var fraction = this.visualizer.timeLoop.fraction;

	// we set the nodeValueIndex based on the timeloop fraction
	if (node.values && node.values.length > 0){
		var nValues = node.values.length;
		node.valueIndex = Math.floor(fraction * nValues);
	} else {
		node.valueIndex = 0;
	}

};
*/

Triptych.BEL3DNodeDisplayer.prototype.stopAnimation = function(node){
	node.valueIndex = 0;
};



Triptych.BEL3DNodeDisplayer.prototype.highlight = function(node){
		node.displayList.main.material = this.visualizer.resources[this.highlightMaterialName];
		node.displayList.main.scale.set(10, 10, 10);
};
	
Triptych.BEL3DNodeDisplayer.prototype.select = function(node){
		node.displayList.main.material = this.visualizer.resources[this.selectMaterialName];
		node.displayList.main.scale.set(15, 15, 15);
};
	
Triptych.BEL3DNodeDisplayer.prototype.plain = function(node){
		node.displayList.main.material = this.visualizer.resources[this.plainMaterialName];
		node.displayList.main.scale.set(5, 5, 5);
};

//------------------------------------------
// Transcriptional Activity
Triptych.TFActivityNodeDisplayer = function(){
	this.plainMaterialName = "grayMaterial";
	this.selectMaterialName = "defaultSurfaceSelectedMaterial";
	this.highlightMaterialName = "defaultSurfaceHighlightedMaterial";
};

Triptych.TFActivityNodeDisplayer.prototype = new Triptych.BEL3DNodeDisplayer();

Triptych.TFActivityNodeDisplayer.prototype.constructor = Triptych.TFActivityNodeDisplayer;

Triptych.TFActivityNodeDisplayer.prototype.makeMain = function(node){
	var geometry = new THREE.CubeGeometry( 1,1,1);
	var cube = this.visualizer.makeMesh(node.position, this.visualizer.resources[this.plainMaterialName], geometry, 10);
	cube.rotation.set(1,0,1);
	return cube;
};

Triptych.TFActivityNodeDisplayer.prototype.highlight = function(node){
		node.displayList.main.material = this.visualizer.resources[this.highlightMaterialName];
		node.displayList.main.scale.set(15, 15, 15);
};
	
Triptych.TFActivityNodeDisplayer.prototype.select = function(node){
		node.displayList.main.material = this.visualizer.resources[this.selectMaterialName];
		node.displayList.main.scale.set(20, 20, 20);
};
	
Triptych.TFActivityNodeDisplayer.prototype.plain = function(node){
		node.displayList.main.material = this.visualizer.resources[this.plainMaterialName];
		node.displayList.main.scale.set(10, 10, 10);
};


//------------------------------------------
// Transcriptional Activity
Triptych.RNAAbundanceNodeDisplayer = function(){
	this.plainMaterialName = "grayMaterial";
	this.selectMaterialName = "defaultSurfaceSelectedMaterial";
	this.highlightMaterialName = "defaultSurfaceHighlightedMaterial";
};

Triptych.RNAAbundanceNodeDisplayer.prototype = new Triptych.BEL3DNodeDisplayer();

Triptych.RNAAbundanceNodeDisplayer.prototype.constructor = Triptych.RNAAbundanceNodeDisplayer;

Triptych.RNAAbundanceNodeDisplayer.prototype.makeMain = function(node){
	var geometry = new THREE.TorusGeometry( 10, 2, 16, 20);
	var torus = this.visualizer.makeMesh(node.position, this.visualizer.resources[this.plainMaterialName], geometry, 1);
	torus.rotation.set(1,0,1);
	return torus;
};

Triptych.RNAAbundanceNodeDisplayer.prototype.highlight = function(node){
		node.displayList.main.material = this.visualizer.resources[this.highlightMaterialName];
		node.displayList.main.scale.set(1.5, 1.5, 1.5);
};
	
Triptych.RNAAbundanceNodeDisplayer.prototype.select = function(node){
		node.displayList.main.material = this.visualizer.resources[this.selectMaterialName];
		node.displayList.main.scale.set(2, 2, 2);
};
	
Triptych.RNAAbundanceNodeDisplayer.prototype.plain = function(node){
		node.displayList.main.material = this.visualizer.resources[this.plainMaterialName];
		node.displayList.main.scale.set(1, 1, 1);
};
//------------------------------------------
// Causal Edge

Triptych.CausalEdgeDisplayer = function(){
	this.plainMaterialName = "grayMaterial";
	this.selectMaterialName = "yellowMaterial";
	this.highlightMaterialName = "defaultSurfaceHighlightedMaterial";
};

Triptych.CausalEdgeDisplayer.prototype = new Triptych.WebGLEdgeDisplayer();

Triptych.CausalEdgeDisplayer.prototype.constructor = Triptych.CausalEdgeDisplayer;

// edge is rendered as a rectangular bar
Triptych.CausalEdgeDisplayer.prototype.makeMain = function(edge){
	var geometry = new THREE.CubeGeometry( 2, 2, this.visualizer.edgeReferenceLength );
	var mesh = new THREE.Mesh( geometry, this.visualizer.resources[this.plainMaterialName]);
	mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;
	edge.animated = true;
	return mesh;
};

// Scale and rotate edge bar from midpoint
Triptych.CausalEdgeDisplayer.prototype.positionMain = function(edge){
	this.visualizer.scaleAndRotateEdge(edge, edge.displayList.main, true);
};

Triptych.CausalEdgeDisplayer.prototype.updateAnimation = function(edge){
	if (edge.animated && edge.from.perturbationStep != null){
		if (edge.from.perturbationStep <= this.visualizer.timeLoop.step){
			this.select(edge);
		} else {
			this.plain(edge);
		}
		if (edge.from.perturbationStep == this.visualizer.timeLoop.step){
			if (!edge.displayList.slider){
				edge.displayList.slider = this.visualizer.makeSlider(edge, edge.displayList.main.material);
				this.visualizer.addElement(edge.displayList.slider, edge, 'slider');
			}
			this.animate(edge);

		} else {
			this.stopAnimation(edge);
		}
	} else {
		this.stopAnimation(edge);
	}
};

// Animate by advancing slider based on main timeloop fraction
Triptych.CausalEdgeDisplayer.prototype.animate = function(edge){
	edge.displayList.slider.visible = true;
	
	var fraction = this.visualizer.timeLoop.stepFraction;
	var v = edge.getVector();
	edge.displayList.slider.position = edge.from.position.clone().add(v.multiplyScalar(fraction));	
};

Triptych.CausalEdgeDisplayer.prototype.stopAnimation = function(edge){
	if (edge.displayList.slider) edge.displayList.slider.visible = false;
	
};

//------------------------------------------
// Inverse Causal Edge

Triptych.InverseCausalEdgeDisplayer = function(){
	this.plainMaterialName = "grayMaterial";
	this.selectMaterialName = "blueMaterial";
	this.highlightMaterialName = "defaultSurfaceHighlightedMaterial";
};

Triptych.InverseCausalEdgeDisplayer.prototype = new Triptych.CausalEdgeDisplayer();

Triptych.InverseCausalEdgeDisplayer.prototype.constructor = Triptych.InverseCausalEdgeDisplayer;


//------------------------------------------
// Generic Non-Causal Edge

Triptych.NonCausalEdgeDisplayer = function(){
	this.plainMaterialName = "grayLineMaterial";
	this.selectMaterialName = "defaultLineSelectedMaterial";
	this.highlightMaterialName = "defaultLineHighlightedMaterial";
};

Triptych.NonCausalEdgeDisplayer.prototype = new Triptych.WebGLEdgeDisplayer();

Triptych.NonCausalEdgeDisplayer.prototype.constructor = Triptych.NonCausalEdgeDisplayer;


//------------------------------------------
// Complex Component - binding

Triptych.BindingEdgeDisplayer = function(){
	this.plainMaterialName = "smallParticleMaterial";
	this.selectMaterialName = "bigParticleMaterial";
	this.highlightMaterialName = "bigParticleMaterial";
};

Triptych.BindingEdgeDisplayer.prototype = new Triptych.WebGLEdgeDisplayer();

Triptych.BindingEdgeDisplayer.prototype.constructor = Triptych.BindingEdgeDisplayer;

// edge is rendered as a rectangular bar
Triptych.BindingEdgeDisplayer.prototype.makeMain = function(edge){
	return this.visualizer.makeDottedBar(this.visualizer.resources.smallParticleMaterial, 40, 3);
};

Triptych.BindingEdgeDisplayer.prototype.positionMain = function(edge){
	this.visualizer.scaleAndRotateEdge(edge, edge.displayList.main, true);
};

//-------------------------------------------------------
//
// Init the displayers, associate them with node and relationship types
//
//-------------------------------------------------------

Triptych.BEL3DVisualizer.prototype.initDefaultDisplayers = function(){
	this.defaultNodeDisplayer = new Triptych.BEL3DNodeDisplayer();
	this.defaultNodeDisplayer.visualizer = this;
	this.defaultEdgeDisplayer = new Triptych.NonCausalEdgeDisplayer();
	this.defaultEdgeDisplayer.visualizer = this;
	
};

Triptych.BEL3DVisualizer.prototype.initDisplayers = function(){
    /*
	this.addNodeDisplayer("transcriptionalActivity", new Triptych.TFActivityNodeDisplayer());
	this.addNodeDisplayer("rnaAbundance", new Triptych.RNAAbundanceNodeDisplayer());
	
	this.addEdgeDisplayer("increases", new Triptych.CausalEdgeDisplayer());
	this.addEdgeDisplayer("decreases", new Triptych.InverseCausalEdgeDisplayer());
	this.addEdgeDisplayer("directlyIncreases", new Triptych.CausalEdgeDisplayer());
	this.addEdgeDisplayer("geneProduct", new Triptych.CausalEdgeDisplayer());
	this.addEdgeDisplayer("actsIn", new Triptych.CausalEdgeDisplayer());
	this.addEdgeDisplayer("directlyDecreases", new Triptych.InverseCausalEdgeDisplayer());
	 */
	this.addEdgeDisplayer("complexComponent", new Triptych.BindingEdgeDisplayer());

    this.addEdgeDisplayer("corresponds", new Triptych.BindingEdgeDisplayer());
    /*
	this.addEdgeDisplayer("INCREASES", new Triptych.CausalEdgeDisplayer());
	this.addEdgeDisplayer("DECREASES", new Triptych.InverseCausalEdgeDisplayer());
	this.addEdgeDisplayer("DIRECTLY_INCREASES", new Triptych.CausalEdgeDisplayer());
	this.addEdgeDisplayer("DIRECTLY_DECREASES", new Triptych.InverseCausalEdgeDisplayer());
	
	this.addNodeDisplayer("TRANSCRIPTIONAL_ACTIVITY", new Triptych.TFActivityNodeDisplayer());
	*/
};



//-------------------------------------------------------
//
// Resources
//
//-------------------------------------------------------


Triptych.BEL3DVisualizer.prototype.initResources = function(){
	this.resources.greenMaterial = new THREE.MeshPhongMaterial( { color: 0x00ff00,  specular:0xbbaa99, shininess:50, shading: THREE.SmoothShading } );
	this.resources.yellowMaterial = new THREE.MeshPhongMaterial( { color: 0xffff00,  specular:0xbbaa99, shininess:50, shading: THREE.SmoothShading } );
	this.resources.blueMaterial = new THREE.MeshPhongMaterial( { color: 0x00ffff,  specular:0xbbaa99, shininess:50, shading: THREE.SmoothShading } );
	this.resources.redMaterial = new THREE.MeshPhongMaterial( { color: 0xff0000,  specular:0xbbaa99, shininess:50, shading: THREE.SmoothShading } );
	this.resources.grayMaterial = new THREE.MeshPhongMaterial( { color: 0x888899,  specular:0xbbaa99, shininess:50, shading: THREE.SmoothShading } );

	this.resources.grayLineMaterial = new THREE.LineBasicMaterial( { color: 0x888899, opacity: 0.5 } );
	this.resources.redLineMaterial = new THREE.LineBasicMaterial( { color: 0xff0000, opacity: 1.0 } );
	
	this.resources.transparentGreenMaterial = new THREE.MeshPhongMaterial( { color: 0x00ff00,  specular:0xbbaa99, shininess:50, opacity: 0.4, shading: THREE.SmoothShading } );
	this.resources.barGeometry = new THREE.CubeGeometry( 2, 2, this.edgeReferenceLength );

    this.resources.whiteDotMap = THREE.ImageUtils.loadTexture("img/textures/white_dot.png");
    this.resources.increaseMap = THREE.ImageUtils.loadTexture("img/textures/yellow_diamond.png");

	this.resources.smallParticleMaterial = new THREE.ParticleBasicMaterial({
			color: 0xFFFFFF,
			map: this.resources.increaseMap,
			size: 3,
			transparent: true
		});
		
	this.resources.bigParticleMaterial = new THREE.ParticleBasicMaterial({
			color: 0xFFFFFF,
			map: this.resources.increaseMap,
			size: 12,
			transparent: true
		});
};

//-------------------------------------------------------
//
// Utilities
//
//-------------------------------------------------------


Triptych.BEL3DVisualizer.prototype.makeSlider = function(edge, material){
	var geometry = new THREE.SphereGeometry( 1, 0.32, 0.16 );
	return this.makeMesh(edge.from.position, material, geometry, 6);
};

Triptych.BEL3DVisualizer.prototype.makeDottedBar = function(material, numberOfDots, dotScale){
	var particles = new THREE.ParticleSystem( this.createDottedBarGeometry(numberOfDots), material);
	particles.scale.x = particles.scale.y = particles.scale.z = dotScale;
	return particles;
};

Triptych.BEL3DVisualizer.prototype.createDottedBarGeometry = function(numberOfDots){
	var geometry = new THREE.Geometry();
	var zSpacing = this.edgeReferenceLength / numberOfDots;
	var particleZ = -this.edgeReferenceLength/2;
	// create a line of particles in the z axis
	for(var p = 0; p < numberOfDots; p++) {
		
		var pVertex = new THREE.Vector3(0, 0, particleZ);
		
		// add it to the geometry
		geometry.vertices.push(pVertex);
		
		// increment particleZ
		particleZ += zSpacing;
	}
	return geometry;
};

Triptych.BEL3DVisualizer.prototype.makeParticleSphere = function(material){
	var particles = new THREE.ParticleSystem( new THREE.SphereGeometry( 1, 0.32, 0.16 ), material);
	particles.scale.x = particles.scale.y = particles.scale.z = 2;
	return particles;
};

Triptych.BEL3DVisualizer.prototype.makeHalo = function(node, name, size){
	var arcShape = new THREE.Shape();
	arcShape.moveTo( 0, 0 );
	arcShape.arc( 3, 3, 40, 0, Math.PI*2, false );

	var holePath = new THREE.Path();
	holePath.moveTo( 0, 0 );
	holePath.arc( 3, 3, 38, 0, Math.PI*2, true );
	arcShape.holes.push( holePath );

	var arc3d = arcShape.extrude( this.extrudeSettings );
	//var arcPoints = arcShape.createPointsGeometry();
	//var arcSpacedPoints = arcShape.createSpacedPointsGeometry();
	
	
	var halo = this.makeMesh(node.position, this.nodeSelectedMaterial, arc3d, size);
	
	//this.scene.add( halo );
	//node.displayList[name] = halo;
	//this.mapDisplayObjectToElement( halo, node, name);
	return halo;
}

Triptych.BEL3DVisualizer.prototype.makeValueBar = function(material){
	var h = this.edgeReferenceLength;
	var geometry = new THREE.CubeGeometry( 4,4,4 );
	geometry.vertices[0].z = h;
	geometry.vertices[1].z = 0;
	geometry.vertices[2].z = h;
	geometry.vertices[3].z = 0;
	geometry.vertices[4].z = 0;
	geometry.vertices[5].z = h;
	geometry.vertices[6].z = 0;
	geometry.vertices[7].z = h;
	var mesh = new THREE.Mesh( geometry, material);
	return mesh;
}