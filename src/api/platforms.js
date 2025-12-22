module.exports = function(req, res) {
  const platforms = require("../../langs.json");
  
  res.json({
    platforms
  });
};