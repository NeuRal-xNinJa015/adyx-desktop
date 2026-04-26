// No-op signing script — skips code signing
exports.default = async function (configuration) {
    // Skip signing entirely
    console.log('  • skipping code signing (no certificate)')
}
