'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Vocabulary', 'language', {
      type: Sequelize.STRING(16),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Vocabulary', 'lastReviewedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Vocabulary', 'nextReviewAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Vocabulary', 'easeFactor', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: 2.5,
    });
    await queryInterface.addColumn('Vocabulary', 'intervalDays', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Vocabulary', 'repetition', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Vocabulary', 'correctStreak', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Vocabulary', 'totalReviews', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Vocabulary', 'totalCorrect', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Vocabulary', 'lastResult', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Vocabulary', 'lastResult');
    await queryInterface.removeColumn('Vocabulary', 'totalCorrect');
    await queryInterface.removeColumn('Vocabulary', 'totalReviews');
    await queryInterface.removeColumn('Vocabulary', 'correctStreak');
    await queryInterface.removeColumn('Vocabulary', 'repetition');
    await queryInterface.removeColumn('Vocabulary', 'intervalDays');
    await queryInterface.removeColumn('Vocabulary', 'easeFactor');
    await queryInterface.removeColumn('Vocabulary', 'nextReviewAt');
    await queryInterface.removeColumn('Vocabulary', 'lastReviewedAt');
    await queryInterface.removeColumn('Vocabulary', 'language');
  },
};
