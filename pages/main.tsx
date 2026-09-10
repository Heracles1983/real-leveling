import React from 'react';
import {createRoot} from 'react-dom/client';
import Game from '../app/game';
import {cloudFetch} from './transport';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<Game request={cloudFetch} assetBase='/real-leveling' cloudMode/>);
