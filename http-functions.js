import wixData from 'wix-data';

export async function post_updateTable(request) {
    try {
        const body = await request.body.json();
        if (!Array.isArray(body)) {
            return { status: 400, body: { error: 'Payload must be an array.' } };
        }

        const requiredFields = ['pos', 'player', 'score', 'r1', 'r2', 'r3', 'r4', 'tot'];
        for (const row of body) {
            for (const field of requiredFields) {
                if (!(field in row)) {
                    return { status: 400, body: { error: `Missing field: ${field}` } };
                }
            }
        }

        const collectionId = 'ESPNLeaderboard';
        const existing = await wixData.query(collectionId).limit(1000).find();
        if (existing.items.length > 0) {
            const toDelete = existing.items.map(item => item._id);
            await wixData.bulkRemove(collectionId, toDelete);
        }

        const insertResults = await wixData.bulkInsert(collectionId, body);
        console.log('bulkInsert results:', insertResults);

        // Only return serializable fields
        return {
            status: 200,
            body: {
                success: true
            }
        };
    } catch (err) {
        console.error('Error in updateTable:', err);
        return { status: 500, body: { error: err.message, stack: err.stack } };
    }
}