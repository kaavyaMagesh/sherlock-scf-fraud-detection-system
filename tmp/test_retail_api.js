async function testRetailTopology() {
    try {
        const response = await fetch('http://localhost:3000/api/retail/topology');
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testRetailTopology();
