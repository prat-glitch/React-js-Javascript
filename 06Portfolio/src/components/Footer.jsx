import React from 'react';
import { Typography, Container, Box, IconButton } from '@mui/material';
import { GitHub as GitHubIcon, LinkedIn as LinkedInIcon, Twitter as TwitterIcon, Favorite as FavoriteIcon } from '@mui/icons-material';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-8">
      <Container maxWidth="lg">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-center md:text-left">
            <Typography variant="h6" className="text-gradient font-bold mb-2">
              John Doe
            </Typography>
            <Typography variant="body2" className="text-gray-400">
              Full Stack Developer & UI/UX Designer
            </Typography>
          </div>

          <div className="flex space-x-4">
            <IconButton
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors duration-300"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </IconButton>
            <IconButton
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors duration-300"
              aria-label="LinkedIn"
            >
              <LinkedInIcon />
            </IconButton>
            <IconButton
              href="#"
              className="text-gray-400 hover:text-purple-400 transition-colors duration-300"
              aria-label="Twitter"
            >
              <TwitterIcon />
            </IconButton>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center">
          <Typography variant="body2" className="text-gray-400 flex items-center justify-center space-x-1">
            <span>© {currentYear} John Doe. Made with</span>
            <FavoriteIcon className="w-4 h-4 text-red-500" />
            <span>and lots of coffee</span>
          </Typography>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;

