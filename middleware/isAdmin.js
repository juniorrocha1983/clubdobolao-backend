module.exports = function(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: "Acesso restrito ao admin." });
    }
    next();
};
