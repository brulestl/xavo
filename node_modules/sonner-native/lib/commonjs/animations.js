"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useToastLayoutAnimations = exports.getToastExiting = exports.getToastEntering = exports.ANIMATION_DURATION = void 0;
var _react = _interopRequireDefault(require("react"));
var _reactNativeReanimated = require("react-native-reanimated");
var _easings = require("./easings.js");
var _context = require("./context.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const ANIMATION_DURATION = exports.ANIMATION_DURATION = 300;
const useToastLayoutAnimations = positionProp => {
  const {
    position: positionCtx
  } = (0, _context.useToastContext)();
  const position = positionProp || positionCtx;
  return _react.default.useMemo(() => ({
    entering: () => {
      'worklet';

      return getToastEntering({
        position
      });
    },
    exiting: () => {
      'worklet';

      return getToastExiting({
        position
      });
    }
  }), [position]);
};
exports.useToastLayoutAnimations = useToastLayoutAnimations;
const getToastEntering = ({
  position
}) => {
  'worklet';

  const animations = {
    opacity: (0, _reactNativeReanimated.withTiming)(1, {
      easing: _easings.easeOutCirc
    }),
    transform: [{
      scale: (0, _reactNativeReanimated.withTiming)(1, {
        easing: _easings.easeOutCirc
      })
    }, {
      translateY: (0, _reactNativeReanimated.withTiming)(0, {
        easing: _easings.easeOutCirc
      })
    }]
  };
  const initialValues = {
    opacity: 0,
    transform: [{
      scale: 0
    }, {
      translateY: position === 'top-center' ? -50 : 50
    }]
  };
  return {
    initialValues,
    animations
  };
};
exports.getToastEntering = getToastEntering;
const getToastExiting = ({
  position
}) => {
  'worklet';

  const animations = {
    opacity: (0, _reactNativeReanimated.withTiming)(0, {
      easing: _easings.easeInOutCubic
    }),
    transform: [{
      translateY: (0, _reactNativeReanimated.withTiming)(position === 'top-center' ? -150 : 150, {
        easing: _easings.easeInOutCubic
      })
    }]
  };
  const initialValues = {
    opacity: 1,
    transform: [{
      translateY: 0
    }]
  };
  return {
    initialValues,
    animations
  };
};
exports.getToastExiting = getToastExiting;
//# sourceMappingURL=animations.js.map