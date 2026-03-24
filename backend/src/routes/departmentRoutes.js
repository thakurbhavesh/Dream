const { Router } = require('express');
const departmentController = require('../controllers/departmentController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const { validateDepartmentPayload, validateDepartmentUpdate } = require('../middlewares/departmentValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, blockRole4, departmentController.getDepartments)
  .post(auth, blockRole4, validateDepartmentPayload, departmentController.createDepartment);

router
  .route('/:id')
  .get(auth, blockRole4, departmentController.getDepartment)
  .put(auth, blockRole4, validateDepartmentUpdate, departmentController.updateDepartment)
  .patch(auth, blockRole4, validateDepartmentUpdate, departmentController.patchDepartment)
  .delete(auth, blockRole4, departmentController.deleteDepartment);

module.exports = router;
