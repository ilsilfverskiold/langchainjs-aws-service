exports.handler = async (event, context) => {
    const { handler: processEmbeddingsHandler } = await import('./processEmbeddings.mjs');
    return processEmbeddingsHandler(event, context);
}