const UserDAO = require("./user-dao").UserDAO;

/* The AllocationsDAO must be constructed with a connected database object */
const AllocationsDAO = function (db) {

  "use strict";

  /* If this constructor is called without the "new" operator, "this" points
   * to the global object. Log a warning and call it correctly. */
  if (false === (this instanceof AllocationsDAO)) {
    console.log("Warning: AllocationsDAO constructor called without 'new' operator");
    return new AllocationsDAO(db);
  }

  const allocationsCol = db.collection("allocations");
  const userDAO = new UserDAO(db);

  this.update = (userId, stocks, funds, bonds, callback) => {
    const parsedUserId = parseInt(userId, 10);

    // Create allocations document
    const allocations = {
      userId: parsedUserId,
      stocks: stocks,
      funds: funds,
      bonds: bonds
    };

    // Use $set + upsert to avoid replacing the whole document accidentally
    allocationsCol.updateOne(
      { userId: parsedUserId },
      { $set: allocations },
      { upsert: true },
      (err) => {
        if (err) return callback(err, null);

        console.log("Updated allocations");

        userDAO.getUserById(parsedUserId, (err, user) => {
          if (err) return callback(err, null);

          // add user details
          allocations.userId = parsedUserId;
          allocations.userName = user.userName;
          allocations.firstName = user.firstName;
          allocations.lastName = user.lastName;

          return callback(null, allocations);
        });
      }
    );
  };

  this.getByUserIdAndThreshold = (userId, threshold, callback) => {
    const parsedUserId = parseInt(userId, 10);

    // build safe criteria (avoid $where / JS execution)
    let criteria = { userId: parsedUserId };

    if (threshold !== undefined && threshold !== null && threshold !== '') {
      const parsedThreshold = parseInt(threshold, 10);
      if (Number.isNaN(parsedThreshold) || parsedThreshold < 0) {
        return callback(`The user supplied threshold: ${threshold} was not valid.`, null);
      }
      criteria.stocks = { $gt: parsedThreshold };
    }

    allocationsCol.find(criteria).toArray((err, allocations) => {
      if (err) return callback(err, null);
      if (!allocations.length) return callback("ERROR: No allocations found for the user", null);

      let doneCounter = 0;
      const userAllocations = [];
      let called = false; // guard to avoid multiple callbacks

      allocations.forEach(alloc => {
        userDAO.getUserById(alloc.userId, (err, user) => {
          if (called) return;
          if (err) {
            called = true;
            return callback(err, null);
          }

          alloc.userName = user.userName;
          alloc.firstName = user.firstName;
          alloc.lastName = user.lastName;

          doneCounter += 1;
          userAllocations.push(alloc);

          if (doneCounter === allocations.length) {
            called = true;
            callback(null, userAllocations);
          }
        });
      });
    });
  };

};

module.exports.AllocationsDAO = AllocationsDAO;