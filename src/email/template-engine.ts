import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ParsedTemplate, RenderedEmail, Contact } from '../types';

export class TemplateEngine {
  private templates: Map<string, ParsedTemplate> = new Map();

  async loadTemplates(templatesDir: string): Promise<void> {
    if (!fs.existsSync(templatesDir)) {
      throw new Error(`Templates directory not found: ${templatesDir}`);
    }

    const files = fs.readdirSync(templatesDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    if (mdFiles.length === 0) {
      throw new Error(`No template files (.md) found in: ${templatesDir}`);
    }

    for (const file of mdFiles) {
      const filePath = path.join(templatesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse frontmatter and body
      const { data, content: body } = matter(content);

      if (!data.subject) {
        console.warn(`Warning: Template ${file} missing subject in frontmatter`);
      }

      const templateName = path.basename(file, '.md');
      this.templates.set(templateName, {
        name: templateName,
        subject: data.subject || '',
        body: body.trim(),
      });

      console.log(`Loaded template: ${templateName}`);
    }

    console.log(`Loaded ${this.templates.size} templates from ${templatesDir}`);
  }

  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  render(templateName: string, contact: Contact): RenderedEmail {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Create variables object from contact
    const variables: Record<string, string> = { ...contact };

    // Replace all {{variable}} placeholders
    let subject = this.replaceVariables(template.subject, variables);
    let body = this.replaceVariables(template.body, variables);

    return { subject, body };
  }

  private replaceVariables(text: string, variables: Record<string, string>): string {
    // Match {{variableName}} pattern
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = variables[varName];
      if (value === undefined) {
        console.warn(`Warning: Variable {{${varName}}} not found in contact data`);
        return match; // Keep the placeholder if variable not found
      }
      return value;
    });
  }
}
