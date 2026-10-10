import React from 'react';
import { PlainFoilText } from './PlainFoilText';

// 웹(개발용)은 박 대신 밝은 단색으로만 보여준다. 앱은 FoilText.native.tsx.
export default React.memo(PlainFoilText);
