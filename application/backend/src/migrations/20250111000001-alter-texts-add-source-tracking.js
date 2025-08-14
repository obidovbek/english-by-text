'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Texts', 'sourceTextId', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addIndex('Texts', ['userId', 'folderId', 'sourceTextId'], {
      name: 'texts_mirror_lookup_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Texts', 'texts_mirror_lookup_idx');
    await queryInterface.removeColumn('Texts', 'sourceTextId');
  },
};
