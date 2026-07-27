import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

interface ICommentTargetInput {
  postId?: unknown;
  pageId?: unknown;
}

export function IsExactlyOneCommentTarget(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isExactlyOneCommentTarget',
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const input = args.object as ICommentTargetInput;
          const hasPost = input.postId !== undefined && input.postId !== null;
          const hasPage = input.pageId !== undefined && input.pageId !== null;
          return hasPost !== hasPage;
        },
        defaultMessage(): string {
          return '必须且只能指定 postId 或 pageId';
        },
      },
    });
  };
}
