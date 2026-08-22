import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Server-owned normalized Flomo memo. Only explicitly mapped fields are public. */
@Entity({ name: 'flomo_public_memo' })
@Index('IDX_flomo_public_memo_created_id', ['sourceCreatedAt', 'id'])
export class FlomoPublicMemoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'char', length: 36 })
  publicId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 191 })
  sourceSlug: string;

  @Column({ type: 'longtext' })
  contentHtml: string;

  @Column({ type: 'text' })
  previewText: string;

  /** Derived only from sanitized visible text; never contains source tags. */
  @Column({ type: 'json', nullable: true })
  displayTags: string[] | null;

  @Column({ type: 'datetime', precision: 3 })
  sourceCreatedAt: Date;

  @Column({ type: 'datetime', precision: 3 })
  sourceUpdatedAt: Date;

  @Column({ type: 'char', length: 64 })
  contentHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
