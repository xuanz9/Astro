import models from '../data/camera-models.json';
export const cameraOptions = models.map(c => ({
  id:c.id, brand:c.brand, model:c.model, name:c.name, source:c.source,
}));
export const cameraBrands = [...new Set(cameraOptions.map(c => c.brand))];
