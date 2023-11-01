"use strict";

var canvas;
var gl;
var program;

var projectionMatrix;
var modelViewMatrix;

var instanceMatrix;

var modelViewMatrixLoc;
var projectionMatrixLoc;
var nMatrix, nMatrixLoc;
var lightPosLoc;
var colorLoc;

// cube points
var vertices = [

    vec4(-0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, 0.5, 0.5, 1.0),
    vec4(0.5, 0.5, 0.5, 1.0),
    vec4(0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, -0.5, -0.5, 1.0),
    vec4(-0.5, 0.5, -0.5, 1.0),
    vec4(0.5, 0.5, -0.5, 1.0),
    vec4(0.5, -0.5, -0.5, 1.0)
];


var baseId = 0;
var middleId = 1;
var outerId = 2;

var baseHeight = 1.0;
var baseWidth = 1.0;
var middleHeight = 3.0;
var outerHeight = 2.0;
var middleWidth = 0.5;
var outerWidth = 0.5;

var lightPosition = vec4(1.0, 1.0, 1.0, 0.0);
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

var materialAmbient = vec4(1.0, 0.0, 1.0, 1.0);
var materialDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
var materialSpecular = vec4(1.0, 1.0, 1.0, 1.0);
var materialShininess = 20.0;

var numNodes = 3;   // base, middle, outer
var theta = [30, 30, 70];
var numAngles = theta.length;
var angle = 0;

var stack = [];
var figure = [];

// for tree traversal
for (var i = 0; i < numNodes; i++) figure[i] = createNode(null, null, null, null);

var vBuffer;
var modelViewLoc;

var pointsArray = [];
var normalsArray = [];
var meshStart;

// t = theta of mesh
var t = -.4;
var phi = 4.3;
var radius = 8.0;
var dr = 5.0 * Math.PI / 180.0;

const black = vec4(0.0, 0.0, 0.0, 1.0);
const red = vec4(1.0, 0.0, 0.0, 1.0);

// lookAt
const at = vec3(0.0, 0.0, 0.0);
const up = vec3(0.0, 1.0, 0.0);
var left = -2.0;
var right = 2.0;
var bottom = -2.0;
var near = -10;
var far = 10;

init();

function scale4(a, b, c) {
    var result = mat4();
    result[0] = a;
    result[5] = b;
    result[10] = c;
    return result;
}

function createNode(transform, render, sibling, child) {
    var node = {
        transform: transform,
        render: render,
        sibling: sibling,
        child: child,
    }
    return node;
}


function initNodes(Id) {

    var m = mat4();

    switch (Id) {

        case baseId:

            m = rotate(theta[baseId], vec3(0, 1, 0));
            figure[baseId] = createNode(m, base, null, middleId);   // base -> middle
            break;

        case middleId:

            m = translate(-(baseWidth / 2.5 + middleWidth), baseHeight, 0.0);
            m = mult(m, rotate(theta[middleId], vec3(0, 0, 1)));
            figure[middleId] = createNode(m, leftmiddle, null, outerId);    // middle -> outer
            break;

        case outerId:

            m = translate(0.0, middleHeight, 0.0);
            m = mult(m, rotate(theta[outerId], vec3(0, 0, 1)));
            figure[outerId] = createNode(m, leftouter, null, null);
            break;
    }

}

function traverse(Id) {

    if (Id == null) return;
    stack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, figure[Id].transform);  // mult concatenated viewmatrix
    figure[Id].render();
    if (figure[Id].child != null) traverse(figure[Id].child);       // traverse down
    modelViewMatrix = stack.pop();
    if (figure[Id].sibling != null) traverse(figure[Id].sibling);   // traverse side (not used)
}

function base() {

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * baseHeight, 0.0));  // get current view from render
    instanceMatrix = mult(instanceMatrix, scale(baseWidth, baseHeight, baseWidth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4 * i, 4);
}

function leftmiddle() {

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * middleHeight, 0.0));    // get current view from render
    instanceMatrix = mult(instanceMatrix, scale(middleWidth, middleHeight, middleWidth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4 * i, 4);
}

function leftouter() {

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * outerHeight, 0.0)); // get current view from render
    instanceMatrix = mult(instanceMatrix, scale(outerWidth, outerHeight, outerWidth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4 * i, 4);
}

function quad(a, b, c, d) {
    pointsArray.push(vertices[a]);
    pointsArray.push(vertices[b]);
    pointsArray.push(vertices[c]);
    pointsArray.push(vertices[d]);

    // get cross product of 3 points (2 vectors) to get the normal vector for lighting
    var t1 = subtract(vertices[b], vertices[a]);
    var t2 = subtract(vertices[c], vertices[a]);
    var normal = normalize(cross(t2, t1));
    normal = vec4(normal[0], normal[1], normal[2], 0.0);

    normalsArray.push(normal);
    normalsArray.push(normal);
    normalsArray.push(normal);
    normalsArray.push(normal);
}


function cube() {
    quad(1, 0, 3, 2);
    quad(2, 3, 7, 6);
    quad(3, 0, 4, 7);
    quad(6, 5, 1, 2);
    quad(4, 5, 6, 7);
    quad(5, 4, 0, 1);
}


function init() {

    canvas = document.getElementById("gl-canvas");

    // change size, rotation of mesh
    document.getElementById("Button3").onclick = function () { radius *= 2.0; };
    document.getElementById("Button4").onclick = function () { radius *= 0.5; };
    document.getElementById("Button5").onclick = function () { t += dr; };
    document.getElementById("Button6").onclick = function () { t -= dr; };
    document.getElementById("Button7").onclick = function () { phi += dr; };
    document.getElementById("Button8").onclick = function () { phi -= dr; };

    gl = canvas.getContext('webgl2');
    if (!gl) { alert("WebGL 2.0 isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // enable depth test
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 2.0);

    // connect shaders to program
    program = initShaders(gl, "vertex-shader", "fragment-shader");

    gl.useProgram(program);

    instanceMatrix = mat4();

    // orthogonal projection
    projectionMatrix = ortho(-10.0, 10.0, -10.0, 10.0, -10.0, 10.0);
    modelViewMatrix = mat4();

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "projectionMatrix"), false, flatten(projectionMatrix));

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix")
    projectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");
    nMatrixLoc = gl.getUniformLocation(program, "uNormalMatrix");


    // initial pointsArray addition
    cube();

    // mesh
    var nRows = 50;
    var nColumns = 50;
    var data = [];
    for (var i = 0; i < nRows; ++i) {
        data.push([]);
        var x = Math.PI * (4 * i / nRows - 2.0);

        for (var j = 0; j < nColumns; ++j) {
            var y = Math.PI * (4 * j / nRows - 2.0);
            var r = Math.sqrt(x * x + y * y);

            // take care of 0/0 for r = 0

            data[i][j] = r ? Math.sin(r) / r : 1.0;
        }
    }
    meshStart = pointsArray.length

    //set size, offsets of mesh
    const increase = 25
    const xOffset = -5
    const yOffset = 0
    const zOffset = 0
    for (var i = 0; i < nRows - 1; i++) {
        for (var j = 0; j < nColumns - 1; j++) {
            pointsArray.push(vec4(increase * i / nRows - 1 + xOffset,        data[i][j] + yOffset,         increase * j / nColumns - 1 + zOffset,           1.0));
            pointsArray.push(vec4(increase * (i + 1) / nRows - 1 + xOffset,  data[i + 1][j] + yOffset,     increase * j / nColumns - 1 + zOffset,           1.0));
            pointsArray.push(vec4(increase * (i + 1) / nRows - 1 + xOffset,  data[i + 1][j + 1] + yOffset, increase * (j + 1) / nColumns - 1 + zOffset,     1.0));
            pointsArray.push(vec4(increase * i / nRows - 1 + xOffset,        data[i][j + 1] + yOffset,     increase * (j + 1) / nColumns - 1 + zOffset,     1.0));
        }
    }

    vBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    var positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    var normalLoc = gl.getAttribLocation(program, "aNormal");
    gl.vertexAttribPointer(normalLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalLoc);

    // sliders to rotate each part of the Pixar Lamp
    document.getElementById("slider0").onchange = function (event) {
        theta[baseId] = event.target.value;
        initNodes(baseId);
    };
    document.getElementById("slider2").onchange = function (event) {
        theta[middleId] = event.target.value;
        initNodes(middleId);
    };
    document.getElementById("slider3").onchange = function (event) {
        theta[outerId] = event.target.value;
        initNodes(outerId);
    };

    // slider to move the light around
    document.getElementById("sliderL").onchange = function (event) {
        lightPosition[0] = event.target.value;
        gl.uniform4fv(lightPosLoc, vec4(event.target.value, lightPosition[1], lightPosition[2], lightPosition[3]));

    };

    // initialize base, middle, outer (draw)
    for (i = 0; i < numNodes; i++) initNodes(i);

    gl.uniform4fv( gl.getUniformLocation(program,
        "uAmbientProduct"),flatten(ambientProduct));
    gl.uniform4fv( gl.getUniformLocation(program,
    "uDiffuseProduct"),flatten(diffuseProduct));
    gl.uniform4fv( gl.getUniformLocation(program,
    "uSpecularProduct"),flatten(specularProduct));
    gl.uniform4fv( gl.getUniformLocation(program,
    "uLightPosition"),flatten(lightPosition));
    gl.uniform1f( gl.getUniformLocation(program,
    "uShininess"),materialShininess);

    lightPosLoc = gl.getUniformLocation(program, "uLightPosition")

    render();
}


function render() {

    gl.clear(gl.COLOR_BUFFER_BIT);

    // calc where camera looks every frame based on user input
    var eye = vec3(radius * Math.sin(t) * Math.cos(phi),
        radius * Math.sin(t) * Math.sin(phi),
        radius * Math.cos(t));

    colorLoc = gl.getUniformLocation(program, "uColor");


    var modelViewMatrix = lookAt(eye, at, up);
    var projectionMatrix = ortho(left, right, bottom, top, near, far);
    nMatrix = normalMatrix(modelViewMatrix, true);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    gl.uniformMatrix3fv(nMatrixLoc, false, flatten(nMatrix)  );
    
    // draw mesh
    for (var i = meshStart; i < pointsArray.length; i += 4) {
        gl.uniform4fv(colorLoc, red);
        gl.drawArrays(gl.TRIANGLE_FAN, i, 4);
        gl.uniform4fv(colorLoc, black);
        gl.drawArrays(gl.LINE_LOOP, i, 4);
    }

    gl.uniform4fv(colorLoc, red);

    // edit rotations by traversing from base -> middle -> outer
    // each modelviewmatrix gets concatenated as it goes so that
    // the latter transformations are based on the former.
    traverse(baseId);

    

    requestAnimationFrame(render);
}
