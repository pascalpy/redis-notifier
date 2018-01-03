/*global require, module*/

//node
var EventEmitter = require('events').EventEmitter;
//npm
var extend = require('extend');

/**
 * Redis Event Notifier
 * Subscribe to Redis Keyspace Notifications(v2.8.x)
 * @param redis
 * @param options
 * @constructor
 */
function RedisNotifier(redis, options) {

  this.settings = extend(true, {
    redis: {
      db: 0
    },
    expired   : true,
    evicted   : true
  }, options || {});


  //Require Redis if its not injected
  if (!redis || typeof redis !== 'object') {
    throw new Error("You must provide a Redis module");
  }

  // Call the super EventEmitter constructor.
  EventEmitter.call(this);

  //Create Redis Subscriber Client
  this.subscriber = redis;
  //Select Appropriate Database
  this.subscriber.select(this.settings.redis.db);

  //Redis Ready To Subscribe
  this.subscriber.on('ready', function () {
    //Subscribe To Expired/Evicted Events
    this._subscribeToEvents.call(this);
  }.bind(this));

  //Bind To Redis Store Message Handler
  this.subscriber.on("pmessage", function (pattern, channel, key) {
    this.emit('message', pattern, channel, key);
  }.bind(this));
}

//Inherit From The EventEmitter Prototype
RedisNotifier.prototype = Object.create(EventEmitter.prototype);

/**
 * Subscribe to Expired/Evicted Events
 * Emitted From Redis
 * @private
 */
RedisNotifier.prototype._subscribeToEvents = function () {
  //events generated every time a key expires
  if (this.settings.expired) {
    this._subscribeKeyevent('expired');
  }
  //events generated when a key is evicted for max-memory
  if (this.settings.evicted) {
    this._subscribeKeyevent('evicted');
  }

  //Let user know its ready to handle subscriptions
  this.emit('ready');
};


/**
 * De-init the subscriptions
 */
RedisNotifier.prototype.deinit = function() {
  if (this.settings.expired) {
    this._unsubscribeKeyevent('expired');
  }
  if (this.settings.evicted) {
    this._unsubscribeKeyevent('evicted');
  }
};

/**
 * Parse The Type/Key From ChannelKey
 * @param channel
 * @returns {{type: *, key: *}}
 */
RedisNotifier.prototype.parseMessageChannel = function (channel) {
  //__keyevent@0__:expired
  var re = /__([a-z]*)+@([0-9])+__:([a-z]*)/i;
  var parts = channel.match(re);

  return {
    type : parts[1],
    key  : parts[3]
  };
};

/**
 * Subscribe To Specific Redis Keyspace Event
 * @param key
 * @private
 */
RedisNotifier.prototype._subscribeKeyspace = function (key) {
  var subscriptionKey = "__keyspace@" + this.settings.redis.db + "__:" + key;
  this.subscriber.psubscribe(subscriptionKey);
};

/**
 * UnSubscribe To Specific Redis Keyspace Event
 * @param key
 * @private
 */
RedisNotifier.prototype._unsubscribeKeyspace = function (key) {
  var subscriptionKey = "__keyspace@" + this.settings.redis.db + "__:" + key;
  this.subscriber.punsubscribe(subscriptionKey);
};

/**
 * Subscribe To KeyEvent (Expired/Evicted)
 * @param key
 * @private
 */
RedisNotifier.prototype._subscribeKeyevent = function (key) {
  var subscriptionKey = "__keyevent@" + this.settings.redis.db + "__:" + key;
  this.subscriber.psubscribe(subscriptionKey);
};


/**
 * UnSubscribe To KeyEvent (Expired/Evicted)
 * @param key
 * @private
 */
RedisNotifier.prototype._unsubscribeKeyevent = function (key) {
  var subscriptionKey = "__keyevent@" + this.settings.redis.db + "__:" + key;
  this.subscriber.punsubscribe(subscriptionKey);
};


module.exports = RedisNotifier;
