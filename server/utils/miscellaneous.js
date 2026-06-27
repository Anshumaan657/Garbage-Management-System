const forRole = (role) => {

    let result = '_id username email phone role';

    if (role == 'admin' || role == 'worker') {
        result += ' region slot';
    }

    return result;

}

function isPointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    // Assume valid GeoJSON Polygon with outer ring in coordinates[0]
    const ring = polygon.coordinates[0];

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];

        const intersects = ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

        if (intersects) inside = !inside;
    }

    return inside;
}

// function isPointInPolygon(point, polygon) {
//     const x = point[0], y = point[1];
//     let inside = false;

//     // Check if polygon is a GeoJSON Feature or Geometry object
//     console.log(polygon);
//     const coords = polygon.geometry ? polygon.geometry.coordinates : polygon.coordinates;

//     // Handle both Polygon and MultiPolygon types
//     console.log("isPointInPolygon, coords: ",coords);
//     console.log("isPointInPolygon, coords[0]: ",coords[0]);
//     console.log("isPointInPolygon, coords[0][0]: ",coords[0][0]);
//     const polygons = coords[0][0] instanceof Array ? coords : [coords];

//     for (let i = 0; i < polygons.length; i++) {
//         const ring = polygons[i][0];

//         for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
//             const xi = ring[j][0], yi = ring[j][1];
//             const xk = ring[k][0], yk = ring[k][1];

//             const intersect = ((yi > y) !== (yk > y))
//                 && (x < (xk - xi) * (y - yi) / (yk - yi) + xi);
//             if (intersect) inside = !inside;
//         }
//     }

//     return inside;

// }

module.exports = { forRole, isPointInPolygon }
