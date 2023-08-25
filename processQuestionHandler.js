exports.handler = async (event, context) => {
    const { handler: processQuestionHandler } = await import('./processQuestion.mjs');
    return processQuestionHandler(event, context);
}