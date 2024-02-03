'use strict';
const canvas = document.querySelector('canvas');

const canvasSize = Math.min(innerWidth, innerHeight) - 16;
const canvasCenter = canvasSize / 2;
const canvasScaleFactor = 2;

canvas.style.width = canvasSize + 'px';
canvas.style.height = canvasSize + 'px';
canvas.width = canvasSize * canvasScaleFactor;
canvas.height = canvasSize * canvasScaleFactor;

const ctx = canvas.getContext('2d', { alpha: false });
ctx.scale(canvasScaleFactor, canvasScaleFactor);
ctx.lineWidth = canvasSize / 400;

/* start of script */
const mouse = [canvasCenter, canvasCenter];
canvas.addEventListener('mousemove', (event) => {
	mouse[0] = event.offsetX;
	mouse[1] = event.offsetY;
});
canvas.addEventListener('mousedown', () => {
	for (let i = 0; i < 10; i++) {
		ballList.push(new RandomBall());
	}
});
function drawMouse() {
	ctx.fillStyle = '#ff0';
	ctx.beginPath();
	ctx.arc(...mouse, 4, 0, 2 * Math.PI);
	ctx.fill();
}

const polygonGriddedOriginal = Object.fromEntries([...Array(12)].map(() => Object.fromEntries([...Array(12)].map(() => []).map((value, index) => [index - 1, value]))).map((value, index) => [index - 1, value]));
const deepCopyPolygonGridded = () => JSON.parse(JSON.stringify(polygonGriddedOriginal));
let polygonGridded = deepCopyPolygonGridded();
console.log(polygonGridded);

const polygonList = [];
class RandomPolygon {
	static idCount = 0;

	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.ox = x;
		this.oy = y;
		this.a = 0;
		this.vx = Math.random() * 0.5 - 0.25;
		this.vy = Math.random() * 0.5 - 0.25;
		this.ma = Math.random() * 0.008 - 0.004;
		this.polygonId = RandomPolygon.idCount++;

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
		ctx.strokeStyle = '#ddf';
		ctx.beginPath();
		ctx.moveTo(this.vertexes[this.vertexes.length - 1].x, this.vertexes[this.vertexes.length - 1].y);
		for (const vertex of this.vertexes) {
			ctx.lineTo(vertex.x, vertex.y);
		}
		ctx.stroke();
	}

	update() {
		this.ox = this.x;
		this.oy = this.y;
		this.x += this.vx;
		this.y += this.vy;
		this.a += this.ma;
		this.gridX = Math.floor(this.x / (canvasSize / 10));
		this.gridY = Math.floor(this.y / (canvasSize / 10));
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
			// sor initial array by polygonId
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

			// execute collision on each polygon
			for (const polygonCollisionClass of polygonCollisionDefiniteList) {
				if (polygonCollisionClass.length > 2) {
					// three colliding points or more
					const randomPolygon = polygonCollisionClass[0].poly;
					const angleToPoly = Math.atan2(randomPolygon.y - this.y, randomPolygon.x - this.x);
					randomPolygon.x += Math.cos(angleToPoly);
					randomPolygon.y += Math.sin(angleToPoly);
					this.x += Math.cos(angleToPoly + Math.PI);
					this.y += Math.sin(angleToPoly + Math.PI);
					console.log('Polygons collision has more than 2 colliding points; collision code has thus been skipped, repeal code is running.');
				} else if (polygonCollisionClass.length === 1) {
					// one colliding point
					console.log('one colliding point');
				} else {
					/**
					 * * break down collision into case A, B or C:
					 * A: two vertexes of this polygon are colliding with one single vertex of the other polygon
					 * B: one vertex of this polygon is colliding with two vertexes of the other polygon (inverse of A)
					 * C: two vertexes of this polygon are colliding with two other vertexes of the other polygon
					 */

					if (polygonCollisionClass[0].thisVertex !== polygonCollisionClass[1].thisVertex && polygonCollisionClass[0].otherVertex !== polygonCollisionClass[1].otherVertex) {
						// C
						console.log('case C', this.polygonId);
					} else if (polygonCollisionClass[0].thisVertex !== polygonCollisionClass[1].thisVertex) {
						// A
						console.log('case A', this.polygonId);
					} else {
						// B
						console.log('case B', this.polygonId);
					}
				}
			}
		}
	}
}

const vertexList = [];
const isBetweenRange = (input, u, v) => input >= Math.min(u, v) && input < Math.max(u, v);
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
					ctx.beginPath();
					ctx.arc(px, py, 4, 0, 2 * Math.PI);
					ctx.fill();

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

					/*
					const surfaceAngle = Math.atan2(y4 - y3, x4 - x3);
					const incidentAngle1 = Math.atan2(this.tree.parent.vy, this.tree.parent.vx);
					const resultingAngle1 = surfaceAngle * 2 - incidentAngle1;
					const incidentAngle2 = Math.atan2(poly.vy, poly.vx);
					const resultingAngle2 = surfaceAngle * 2 - incidentAngle2;

					this.tree.parent.vx = Math.cos(resultingAngle1);
					this.tree.parent.vy = Math.sin(resultingAngle1);
					poly.vx = Math.cos(resultingAngle2);
					poly.vy = Math.sin(resultingAngle2);

					//this.tree.parent.x += this.tree.parent.vx;
					//this.tree.parent.y += this.tree.parent.vy;
					//poly.x += poly.vx;
					//poly.y += poly.vy;
					*/
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
		this.vx = Math.cos(randomAngle);
		this.vy = Math.sin(randomAngle);
	}

	draw() {
		ctx.beginPath();
		ctx.arc(this.x, this.y, 4, 0, 2 * Math.PI);
		ctx.fill();
	}
	update() {
		// move ball
		this.x += this.vx;
		this.y += this.vy;
		// remove ball if off-canvas
		if (Math.abs(this.x - canvasCenter) > canvasCenter || Math.abs(this.y - canvasCenter) > canvasCenter) {
			ballList.splice(ballList.indexOf(this), 1);
		}
	}
	collide() {
		for (const poly of polygonList) {
			// skip if polygon is too far
			if (Math.sqrt((poly.x - this.x) ** 2 + (poly.y - this.y) ** 2) > canvasSize / 10) continue;

			for (const vertex of poly.vertexes) {
				// do the math!
				const x1 = vertex.x;
				const y1 = vertex.y;
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
				if (Math.sqrt((closestX - this.x) ** 2 + (closestY - this.y) ** 2) < 4) {
					const surfaceAngle = Math.atan2(y2 - y1, x2 - x1);
					const incidentAngle = Math.atan2(this.vy, this.vx);
					const resultingAngle = surfaceAngle * 2 - incidentAngle;

					this.vx = Math.cos(resultingAngle);
					this.vy = Math.sin(resultingAngle);

					const a = Math.atan2(this.y - closestY, this.x - closestX);
					this.x = closestX + 4 * Math.cos(a);
					this.y = closestY + 4 * Math.sin(a);
				}
			}
		}
	}
}

function main() {
	ctx.clearRect(0, 0, canvasSize, canvasSize);
	polygonGridded = deepCopyPolygonGridded();

	if (polygonList.length < 5) {
		polygonList.push(new RandomPolygon(Math.random() * canvasSize, Math.random() * canvasSize));
	}
	for (const poly of polygonList) {
		poly.draw();
		poly.update();
	}
	for (const ball of ballList) {
		ball.draw();
		ball.update();
		ball.collide();
	}
	drawMouse();

	requestAnimationFrame(main);
}
main();
