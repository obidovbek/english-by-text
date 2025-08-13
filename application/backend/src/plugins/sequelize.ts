import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  ForeignKey,
} from 'sequelize';

declare module 'fastify' {
  interface FastifyInstance {
    sequelize: Sequelize;
    models: {
      User: typeof UserModel;
      Folder: typeof FolderModel;
      Text: typeof TextModel;
      Sentence: typeof SentenceModel;
      Token: typeof TokenModel;
      Vocabulary: typeof VocabularyModel;
    };
  }
}

class UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  declare id: CreationOptional<number>;
  declare telegramId: number;
  declare firstName: string;
  declare lastName: string | null;
  declare username: string | null;
  declare phone: string | null;
  declare languageCode: string | null;
  declare photoUrl: string | null;
  declare lastGreetingMessageId: CreationOptional<number>;
  declare lastGreetingVariant: CreationOptional<number>;
}

class FolderModel extends Model<
  InferAttributes<FolderModel>,
  InferCreationAttributes<FolderModel>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<UserModel['id']>;
  declare name: string;
  declare parentId: number | null;
  declare isGlobal: CreationOptional<boolean>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare parent?: NonAttribute<FolderModel | null>;
  declare children?: NonAttribute<FolderModel[]>;
}

class TextModel extends Model<InferAttributes<TextModel>, InferCreationAttributes<TextModel>> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<UserModel['id']>;
  declare folderId: ForeignKey<FolderModel['id']>;
  declare title: string;
  declare uzRaw: string;
  declare enRaw: string;
  declare lastIndex: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

class SentenceModel extends Model<
  InferAttributes<SentenceModel>,
  InferCreationAttributes<SentenceModel>
> {
  declare id: CreationOptional<number>;
  declare textId: ForeignKey<TextModel['id']>;
  declare index: number;
  declare uz: string;
  declare en: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

class TokenModel extends Model<InferAttributes<TokenModel>, InferCreationAttributes<TokenModel>> {
  declare id: CreationOptional<number>;
  declare sentenceId: ForeignKey<SentenceModel['id']>;
  declare order: number;
  declare uz: string;
  declare en: string;
  declare pos: string | null;
  declare note: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

class VocabularyModel extends Model<
  InferAttributes<VocabularyModel>,
  InferCreationAttributes<VocabularyModel>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<UserModel['id']>;
  declare word: string;
  declare translation: string;
  declare note: string | null;
  declare language: string | null;
  declare lastReviewedAt: Date | null;
  declare nextReviewAt: Date | null;
  declare easeFactor: number | null;
  declare intervalDays: number | null;
  declare repetition: number | null;
  declare correctStreak: number | null;
  declare totalReviews: number | null;
  declare totalCorrect: number | null;
  declare lastResult: boolean | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const sequelizePlugin: FastifyPluginAsync = async (fastify) => {
  const databaseName = process.env.POSTGRES_DB;
  const databaseUser = process.env.POSTGRES_USER;
  const databasePassword = process.env.POSTGRES_PASSWORD;
  const databaseHost = process.env.POSTGRES_HOST || 'postgres';
  const databasePort = Number(process.env.POSTGRES_PORT || 5432);

  if (!databaseName || !databaseUser || databasePassword === undefined) {
    throw new Error(
      'Database configuration invalid. Ensure POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD are set',
    );
  }

  const sequelize = new Sequelize(databaseName, databaseUser, databasePassword, {
    host: databaseHost,
    port: databasePort,
    dialect: 'postgres',
    logging: false,
  });

  UserModel.init(
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      telegramId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        unique: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      languageCode: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      photoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastGreetingMessageId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      lastGreetingVariant: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    { sequelize, modelName: 'User', tableName: 'Users', timestamps: true },
  );

  FolderModel.init(
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        set(value: string) {
          // trim on set
          this.setDataValue('name', (value ?? '').trim());
        },
      },
      parentId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      isGlobal: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    { sequelize, modelName: 'Folder', tableName: 'Folders', timestamps: true },
  );

  TextModel.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      folderId: { type: DataTypes.BIGINT, allowNull: false },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        set(value: string) {
          this.setDataValue('title', (value ?? '').trim());
        },
      },
      uzRaw: { type: DataTypes.TEXT, allowNull: false },
      enRaw: { type: DataTypes.TEXT, allowNull: false },
      lastIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'Text', tableName: 'Texts', timestamps: true },
  );

  SentenceModel.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      textId: { type: DataTypes.BIGINT, allowNull: false },
      index: { type: DataTypes.INTEGER, allowNull: false },
      uz: { type: DataTypes.TEXT, allowNull: false },
      en: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'Sentence', tableName: 'Sentences', timestamps: true },
  );

  TokenModel.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      sentenceId: { type: DataTypes.BIGINT, allowNull: false },
      order: { type: DataTypes.INTEGER, allowNull: false },
      uz: { type: DataTypes.STRING, allowNull: false },
      en: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
      pos: { type: DataTypes.STRING(16), allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'Token', tableName: 'Tokens', timestamps: true },
  );

  VocabularyModel.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      word: {
        type: DataTypes.STRING(200),
        allowNull: false,
        set(value: string) {
          this.setDataValue('word', (value ?? '').trim());
        },
      },
      translation: { type: DataTypes.STRING(400), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      language: { type: DataTypes.STRING(16), allowNull: true, defaultValue: null },
      lastReviewedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      nextReviewAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      easeFactor: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 2.5 },
      intervalDays: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      repetition: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      correctStreak: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      totalReviews: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      totalCorrect: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      lastResult: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'Vocabulary', tableName: 'Vocabulary', timestamps: true },
  );

  // Associations
  FolderModel.belongsTo(UserModel, { foreignKey: 'userId' });
  FolderModel.belongsTo(FolderModel, { as: 'parent', foreignKey: 'parentId' });
  FolderModel.hasMany(FolderModel, { as: 'children', foreignKey: 'parentId' });

  TextModel.belongsTo(UserModel, { foreignKey: 'userId' });
  TextModel.belongsTo(FolderModel, { foreignKey: 'folderId' });
  TextModel.hasMany(SentenceModel, { as: 'sentences', foreignKey: 'textId' });

  SentenceModel.belongsTo(TextModel, { foreignKey: 'textId' });
  SentenceModel.hasMany(TokenModel, { as: 'tokens', foreignKey: 'sentenceId' });

  TokenModel.belongsTo(SentenceModel, { foreignKey: 'sentenceId' });
  VocabularyModel.belongsTo(UserModel, { foreignKey: 'userId' });

  await sequelize.authenticate();

  fastify.decorate('sequelize', sequelize);
  fastify.decorate('models', {
    User: UserModel,
    Folder: FolderModel,
    Text: TextModel,
    Sentence: SentenceModel,
    Token: TokenModel,
    Vocabulary: VocabularyModel,
  });

  fastify.addHook('onClose', async (instance) => {
    await instance.sequelize.close();
  });
};

export default fp(sequelizePlugin, { name: 'sequelize' });
