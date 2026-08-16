try { eval(WScript.StdIn.ReadAll().replace('const GEOPORTAL_LAYERS', 'var GEOPORTAL_LAYERS')); WScript.Echo('OK'); } catch (e) { WScript.Echo('Error: ' + e.name + ': ' + e.message); }
