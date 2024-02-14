'use strict';

/* ctx initialization */
const mainCanvas = document.getElementById('main');
const shadowingCanvas = document.getElementById('shadowing');

const canvasSize = Math.min(innerWidth, innerHeight) - 32;
const canvasCenter = canvasSize / 2;
const canvasScaleFactor = 2;

mainCanvas.width = canvasSize * canvasScaleFactor;
mainCanvas.height = canvasSize * canvasScaleFactor;
shadowingCanvas.width = canvasSize * canvasScaleFactor;
shadowingCanvas.height = canvasSize * canvasScaleFactor;

const mainCtx = mainCanvas.getContext('2d');
mainCtx.scale(canvasScaleFactor, canvasScaleFactor);
mainCtx.lineWidth = canvasSize / 400;

const shadowingCtx = shadowingCanvas.getContext('2d', { alpha: false });
shadowingCtx.scale(canvasScaleFactor, canvasScaleFactor);
shadowingCtx.lineWidth = canvasSize / 400;

/* start of script */
window.interactables = {
	playbackSpeed: 1,
	lightColor: 60,
	ballSize: 8,
	nbOfPoly: 20,
};

const mouse = [canvasCenter, canvasCenter];
function saveMousePosition(event) {
	mouse[0] = event.offsetX * (canvasSize / parseInt(mainCanvas.offsetWidth, 10));
	mouse[1] = event.offsetY * (canvasSize / parseInt(mainCanvas.offsetHeight, 10));
}
document.addEventListener('pointermove', (event) => {
	if (event.target.nodeName === 'CANVAS') {
		event.preventDefault();
		saveMousePosition(event);
	}
});
document.addEventListener('pointerdown', (event) => {
	if (event.target.nodeName === 'CANVAS') {
		event.preventDefault();
		saveMousePosition(event);
		ballList.push(new RandomBall(), new RandomBall());
	}
});

function drawMouse() {
	mainCtx.fillStyle = '#fff';
	mainCtx.beginPath();
	mainCtx.arc(...mouse, window.interactables.ballSize, 0, 2 * Math.PI);
	mainCtx.fill();

	const light = shadowingCtx.createRadialGradient(...mouse, 0, ...mouse, canvasSize);
	light.addColorStop(0, `hsl(${window.interactables.lightColor}, 100%, 40%)`);
	light.addColorStop(1, '#000');
	shadowingCtx.fillStyle = light;
	shadowingCtx.arc(...mouse, canvasSize, 0, 2 * Math.PI);
	shadowingCtx.fill();
}

const polygonGriddedOriginal = Object.fromEntries([...Array(12)].map(() => Object.fromEntries([...Array(12)].map(() => []).map((value, index) => [index - 1, value]))).map((value, index) => [index - 1, value]));
const deepCopyPolygonGridded = () => JSON.parse(JSON.stringify(polygonGriddedOriginal));
let polygonGridded = deepCopyPolygonGridded();
console.log(polygonGridded);

let polygonList = [];
class RandomPolygon {
	static idCount = 0;
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.ox = x;
		this.oy = y;
		this.a = 0;
		const theta = Math.random() * 2 * Math.PI;
		this.vx = 0.2 * Math.cos(theta);
		this.vy = 0.2 * Math.sin(theta);
		this.ma = Math.random() * 0.008 - 0.004;
		this.polygonId = RandomPolygon.idCount++;

		// sounds
		this.lastSoundMS = 0;

		// children tree
		this.vertexes = [];
		const maxVertexes = Math.floor(Math.random() * 3) + 3; // 3 to 5 vertexes
		for (let i = 0; i < maxVertexes; i++) {
			this.vertexes.push(new RandomVertex((i + 0.2) / maxVertexes, (i + 0.8) / maxVertexes, this));
		}
		for (let i = 0; i < maxVertexes; i++) {
			this.vertexes[i].tree.previousChild = this.vertexes[(i + maxVertexes - 1) % maxVertexes];
			this.vertexes[i].tree.nextChild = this.vertexes[(i + 1) % maxVertexes];
		}
	}

	draw() {
		mainCtx.strokeStyle = '#ddf';
		mainCtx.beginPath();
		mainCtx.moveTo(this.vertexes[this.vertexes.length - 1].x, this.vertexes[this.vertexes.length - 1].y);
		for (const vertex of this.vertexes) {
			mainCtx.lineTo(vertex.x, vertex.y);
			// shadowing
			vertex.shadow();
		}
		mainCtx.stroke();
	}

	update() {
		this.ox = this.x;
		this.oy = this.y;
		this.x += this.vx;
		this.y += this.vy;
		this.a += this.ma;
		this.gridX = Math.max(Math.min(Math.floor(this.x / (canvasSize / 10)), 0), 9);
		this.gridY = Math.max(Math.min(Math.floor(this.y / (canvasSize / 10)), 0), 9);
		polygonGridded[this.gridY][this.gridX].push(this);

		// compile a list of nearby polygons
		const polygonCollisionChecklist = [];
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				const grid = polygonGridded[this.gridY + i][this.gridX + j];
				polygonCollisionChecklist.push(...grid);
			}
		}
		// execute vertex scripts + collisions check
		let polygonCollisionDefiniteList = [];
		polygonCollisionChecklist.splice(polygonCollisionChecklist.indexOf(this), 1);
		for (const vertex of this.vertexes) {
			vertex.update();
			polygonCollisionDefiniteList.push(...vertex.collide(polygonCollisionChecklist));
		}
		// execute collision code
		if (polygonCollisionDefiniteList.length > 0) {
			this.collide(polygonCollisionDefiniteList);
		}
	}

	collide(polygonCollisionDefiniteList) {
		// sort initial array by polygonId
		polygonCollisionDefiniteList.sort((a, b) => a.poly.polygonId < b.poly.polygonId);
		// then classify the same polygons into their subarray
		polygonCollisionDefiniteList = polygonCollisionDefiniteList.reduce((accumulator, currentValue) => {
			const lastArray = accumulator[accumulator.length - 1];
			if (lastArray && lastArray[0].poly === currentValue.poly) {
				lastArray.push(currentValue);
			} else {
				accumulator.push([currentValue]);
			}
			return accumulator;
		}, []);

		// repeal code for unhandled collisions
		const repeal = (polygonCollisions) => {
			const randomPolygon = polygonCollisions[0].poly;
			const angleToPoly = Math.atan2(randomPolygon.y - this.y, randomPolygon.x - this.x);
			randomPolygon.x += Math.cos(angleToPoly);
			randomPolygon.y += Math.sin(angleToPoly);
			this.x += 0.05 * Math.cos(angleToPoly + Math.PI);
			this.y += 0.05 * Math.sin(angleToPoly + Math.PI);
		};
		// execute collision on each polygon
		for (const polygonCollisions of polygonCollisionDefiniteList) {
			if (polygonCollisions.length > 2) {
				// three colliding points or more
				repeal(polygonCollisions);
			} else if (polygonCollisions.length === 1) {
				// one colliding point
				repeal(polygonCollisions);
			} else {
				// find the common vertex for collisions that imply two polygon segments
				const findCommonVertexXY = (vertex1, vertex2) => {
					if (vertex1.tree.nextChild === vertex2) return [vertex2.x, vertex2.y];
					else if (vertex2.tree.nextChild === vertex1) return [vertex1.x, vertex1.y];
					else {
						repeal(polygonCollisions);
						console.warn('Common vertex not found; repeal code is running.');
						return [null, null];
					}
				};
				const findMiddlePointXY = (px1, py1, px2, py2) => [(px1 + px2) / 2, (py1 + py2) / 2];

				/**
				 * * break down collision into case A, B or C:
				 * A: two segments of this polygon are colliding with one single segment of the other polygon
				 * B: one segment of this polygon is colliding with two segments of the other polygon (inverse of A)
				 * C: two segments of this polygon are colliding with two other segments of the other polygon
				 */
				const randomPolygon = polygonCollisions[0].poly;
				let keyVertex1x, keyVertex1y, keyVertex2x, keyVertex2y;
				if (polygonCollisions[0].thisVertex !== polygonCollisions[1].thisVertex && polygonCollisions[0].otherVertex !== polygonCollisions[1].otherVertex) {
					[keyVertex1x, keyVertex1y] = findCommonVertexXY(polygonCollisions[0].thisVertex, polygonCollisions[1].thisVertex);
					[keyVertex2x, keyVertex2y] = findCommonVertexXY(polygonCollisions[0].otherVertex, polygonCollisions[1].otherVertex);
				} else if (polygonCollisions[0].thisVertex !== polygonCollisions[1].thisVertex) {
					// A
					[keyVertex1x, keyVertex1y] = findCommonVertexXY(polygonCollisions[0].thisVertex, polygonCollisions[1].thisVertex);
					[keyVertex2x, keyVertex2y] = findMiddlePointXY(polygonCollisions[0].px, polygonCollisions[0].py, polygonCollisions[1].px, polygonCollisions[1].py);
				} else {
					// B
					[keyVertex1x, keyVertex1y] = findMiddlePointXY(polygonCollisions[0].px, polygonCollisions[0].py, polygonCollisions[1].px, polygonCollisions[1].py);
					[keyVertex2x, keyVertex2y] = findCommonVertexXY(polygonCollisions[0].otherVertex, polygonCollisions[1].otherVertex);
				}

				if (keyVertex1x === null || keyVertex2x === null) continue;

				const surfaceAngle = Math.atan2(polygonCollisions[1].py - polygonCollisions[0].py, polygonCollisions[1].px - polygonCollisions[0].px);
				const incidentAngle1 = Math.atan2(this.vy, this.vx);
				const resultingAngle1 = surfaceAngle * 2 - incidentAngle1;
				this.vx = 0.2 * Math.cos(resultingAngle1);
				this.vy = 0.2 * Math.sin(resultingAngle1);
				const incidentAngle2 = Math.atan2(randomPolygon.vy, randomPolygon.vx);
				const resultingAngle2 = surfaceAngle * 2 - incidentAngle2;
				randomPolygon.vx = 0.2 * Math.cos(resultingAngle2);
				randomPolygon.vy = 0.2 * Math.sin(resultingAngle2);

				const halfDistance = Math.min(Math.sqrt((keyVertex2x - keyVertex1x) ** 2 + (keyVertex2y - keyVertex1y) ** 2) / 2, canvasSize / 25);
				const angleToOtherVertex = Math.atan2(keyVertex2y - keyVertex1y, keyVertex2x - keyVertex1x);
				this.x += halfDistance * Math.cos(angleToOtherVertex);
				this.y += halfDistance * Math.sin(angleToOtherVertex);
				randomPolygon.x += halfDistance * Math.cos(angleToOtherVertex + Math.PI);
				randomPolygon.y += halfDistance * Math.sin(angleToOtherVertex + Math.PI);
			}

			// "immersive" (kinda) synth music that occurs when polygons collide
			if (Date.now() - this.lastSoundMS > 1000) {
				this.lastSoundMS = Date.now();
				try {
					if (Math.random() < 5) {
						window.playChoir();
					} else {
						window.playSynth();
					}
				} catch (error) {
					console.warn(error);
				}
			}
		}
	}
}

const vertexList = [];
class RandomVertex {
	constructor(minA, maxA, parent) {
		const polyMinRadius = canvasSize / 40;
		const polyMaxRadius = canvasSize / 10;

		this.theta = (Math.random() * (maxA - minA) + minA) * Math.PI * 2;
		this.norm = Math.random() * (polyMaxRadius - polyMinRadius) + polyMinRadius;
		this.x = canvasSize / 2;
		this.y = 0;

		// quick-access trees
		this.tree = {
			parent: parent,
			previousChild: undefined,
			nextChild: undefined,
		};

		vertexList.push(this);
	}

	shadow() {
		const distanceToPointer = Math.sqrt((mouse[0] - this.x) ** 2 + (mouse[1] - this.y) ** 2);
		const vectorMultiplier = (5 * canvasSize) / distanceToPointer;

		const nextChildX = this.tree.nextChild.x;
		const nextChildY = this.tree.nextChild.y;

		shadowingCtx.fillStyle = '#111a';
		shadowingCtx.beginPath();
		shadowingCtx.moveTo(this.x, this.y);
		shadowingCtx.lineTo(nextChildX, nextChildY);
		shadowingCtx.lineTo(nextChildX + (nextChildX - mouse[0]) * vectorMultiplier, nextChildY + (nextChildY - mouse[1]) * vectorMultiplier);
		shadowingCtx.lineTo(this.x + (this.x - mouse[0]) * vectorMultiplier, this.y + (this.y - mouse[1]) * vectorMultiplier);
		shadowingCtx.closePath();
		shadowingCtx.fill();
	}

	update() {
		// update the x/y coordinates of the vertex
		this.x = Math.cos(this.tree.parent.a + this.theta) * this.norm + this.tree.parent.x;
		this.y = Math.sin(this.tree.parent.a + this.theta) * this.norm + this.tree.parent.y;
		this.gridX = Math.max(Math.min(Math.floor(this.x / (canvasSize / 10)), 0), 9);
		this.gridY = Math.max(Math.min(Math.floor(this.y / (canvasSize / 10)), 0), 9);
	}

	collide(polygonCollisionChecklist) {
		//* wall collision
		const distanceToXWall = Math.abs(this.x - canvasCenter);
		if (distanceToXWall > canvasCenter) {
			if (this.x < canvasCenter) {
				this.tree.parent.x -= this.x;
				this.tree.parent.vx = Math.abs(this.tree.parent.vx);
			} else {
				this.tree.parent.x += canvasSize - this.x;
				this.tree.parent.vx = Math.abs(this.tree.parent.vx) * -1;
			}
		}
		const distanceToYWall = Math.abs(this.y - canvasCenter);
		if (distanceToYWall > canvasCenter) {
			if (this.y < canvasCenter) {
				this.tree.parent.y -= this.y;
				this.tree.parent.vy = Math.abs(this.tree.parent.vy);
			} else {
				this.tree.parent.y += canvasSize - this.y;
				this.tree.parent.vy = Math.abs(this.tree.parent.vy) * -1;
			}
		}

		const isBetweenRange = (input, u, v) => input >= Math.min(u, v) && input <= Math.max(u, v);
		//* vertex-vertex collision
		const polygonCollisionDefiniteList = [];
		const x1 = this.x;
		const y1 = this.y;
		const x2 = this.tree.nextChild.x;
		const y2 = this.tree.nextChild.y;
		for (const poly of polygonCollisionChecklist) {
			// skip if polygonId is smaller than this
			if (poly.polygonId <= this.polygonId) continue;

			for (const vertex of poly.vertexes) {
				// do the math!
				const x3 = vertex.x;
				const y3 = vertex.y;
				const x4 = vertex.tree.nextChild.x;
				const y4 = vertex.tree.nextChild.y;

				const m1 = (y2 - y1) / (x2 - x1);
				const b1 = y1 - m1 * x1;
				const m2 = (y4 - y3) / (x4 - x3);
				const b2 = y3 - m2 * x3;

				const px = (b2 - b1) / (m1 - m2);
				const py = m1 * px + b1;

				if (isBetweenRange(px, x1, x2) && isBetweenRange(px, x3, x4) && isBetweenRange(py, y1, y2) && isBetweenRange(py, y3, y4)) {
					polygonCollisionDefiniteList.push({
						poly: poly,
						thisVertex: this,
						otherVertex: vertex,
						px: px,
						py: py,
						x1: x1,
						y1: y1,
						x2: x2,
						y2: y2,
						x3: x3,
						y3: y3,
						x4: x4,
						y4: y4,
					});
				}
			}
		}

		// return a smart list of every colliding polygons
		return polygonCollisionDefiniteList;
	}
}

const ballList = [];
class RandomBall {
	constructor() {
		[this.x, this.y] = [...mouse];

		// a random moving angle
		const randomAngle = Math.random() * 2 * Math.PI;
		this.vx = 2 * Math.cos(randomAngle);
		this.vy = 2 * Math.sin(randomAngle);
	}

	draw() {
		mainCtx.fillStyle = `hsl(${window.interactables.lightColor}, 100%, 60%)`;
		mainCtx.beginPath();
		mainCtx.arc(this.x, this.y, window.interactables.ballSize, 0, 2 * Math.PI);
		mainCtx.fill();
	}

	update() {
		// move ball
		this.x += this.vx;
		this.y += this.vy;
		// remove ball if off-canvas
		if (Math.abs(this.x - canvasCenter) > canvasCenter || Math.abs(this.y - canvasCenter) > canvasCenter) {
			ballList.splice(ballList.indexOf(this), 1);
		}

		// collisions
		for (const poly of polygonList) {
			// skip if polygon is too far
			if (Math.sqrt((poly.x - this.x) ** 2 + (poly.y - this.y) ** 2) > canvasSize / 10 + window.interactables.ballSize * 2) continue;

			for (const vertex of poly.vertexes) {
				const x1 = vertex.x;
				const y1 = vertex.y;
				if (Math.sqrt((x1 - this.x) ** 2 + (y1 - this.y) ** 2) < window.interactables.ballSize) {
					// vertex-ball collision
					const surfaceAngle = Math.atan2(this.y - y1, this.x - x1) + Math.PI / 2;
					const incidentAngle = Math.atan2(this.vy, this.vx);
					const resultingAngle = surfaceAngle * 2 - incidentAngle;

					this.vx = 2 * Math.cos(resultingAngle);
					this.vy = 2 * Math.sin(resultingAngle);

					this.x = x1 + window.interactables.ballSize * Math.cos(surfaceAngle - Math.PI / 2);
					this.y = y1 + window.interactables.ballSize * Math.sin(surfaceAngle - Math.PI / 2);
				} else {
					// segment-ball collision
					const x2 = vertex.tree.nextChild.x;
					const y2 = vertex.tree.nextChild.y;

					const distX = x2 - x1;
					const distY = y2 - y1;
					const norm = Math.sqrt(distX ** 2 + distY ** 2);
					const dotProd = ((this.x - x1) * distX + (this.y - y1) * distY) / norm ** 2;

					const closestX = x1 + dotProd * distX;
					const closestY = y1 + dotProd * distY;

					// skip if closest point is outside the boundary of line segment
					if (Math.sign(closestX - x1) === Math.sign(closestX - x2) || Math.sign(closestY - y1) === Math.sign(closestY - y2)) continue;
					// check if the distance to the closest point is under the radius of the ball
					if (Math.sqrt((closestX - this.x) ** 2 + (closestY - this.y) ** 2) < window.interactables.ballSize) {
						const surfaceAngle = Math.atan2(y2 - y1, x2 - x1);
						const incidentAngle = Math.atan2(this.vy, this.vx);
						const resultingAngle = surfaceAngle * 2 - incidentAngle;

						this.vx = 2 * Math.cos(resultingAngle);
						this.vy = 2 * Math.sin(resultingAngle);

						const a = Math.atan2(this.y - closestY, this.x - closestX);
						this.x = closestX + window.interactables.ballSize * Math.cos(a);
						this.y = closestY + window.interactables.ballSize * Math.sin(a);
					}
				}
			}
		}
	}
}

function main() {
	mainCtx.clearRect(0, 0, canvasSize, canvasSize);

	// push new polygons
	if (polygonList.length !== window.interactables.nbOfPoly) {
		if (polygonList.length > window.interactables.nbOfPoly) {
			polygonList.splice(window.interactables.nbOfPoly, polygonList.length - window.interactables.nbOfPoly);
		} else {
			polygonList.push(new RandomPolygon(Math.random() * canvasSize, Math.random() * canvasSize));
		}
	}

	// cursor
	drawMouse();

	// playback
	for (let i = 0; i < window.interactables.playbackSpeed; i++) {
		polygonGridded = deepCopyPolygonGridded();
		for (const poly of polygonList) {
			poly.update();
		}
		for (const ball of ballList) {
			ball.update();
		}
	}

	// draw
	for (const poly of polygonList) {
		poly.draw();
	}
	for (const ball of ballList) {
		ball.draw();
	}

	// call again
	requestAnimationFrame(main);
}

/*
for (let i = 0; i < 20; i++) {
	polygonList.push(new RandomPolygon(Math.random() * canvasSize, Math.random() * canvasSize));
}
*/
main();
